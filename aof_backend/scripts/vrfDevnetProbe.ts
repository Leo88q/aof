/**
 * [F-06] Devnet probe of the Switchboard On-Demand path the game depends on,
 * run against the real devnet queue, oracles and gateways:
 *
 *   1. oracle selection: on every candidate of the queue inspection our
 *      oracleEligible() gives the same verdict as the SDK's own rule, both
 *      compute the same majority oracle version, and selectOracle() returns
 *      an eligible oracle on that version;
 *   2. one randomness account is created (its authority is the probe wallet,
 *      not a program PDA) and committed to every eligible oracle in turn;
 *   3. every commit is revealed through vrfReveal(), the production code: the
 *      gateway of the committed oracle is asked WITHOUT an RPC URL (fetch is
 *      wrapped to prove that no `rpc` field left this process);
 *   4. the signed value is submitted with randomness_reveal and read back from
 *      the account;
 *   5. the account is closed (its rent comes back; the LUT rent does not).
 *
 * The game programs are not involved: they wrap exactly these Switchboard
 * calls in a CPI, which the Rust host tests cover with an emulated Switchboard.
 *
 * Wallet: DEVNET_PROBE_KEYPAIR (solana-keygen JSON or base58) holding devnet
 * SOL; otherwise a fresh wallet asks the faucet for an airdrop. Without funds
 * the probe is SKIPPED with exit 0, because faucets rate-limit CI runners.
 * Exit 1 when the selectors disagree or no eligible oracle completes a round
 * trip. The markdown report goes to VRF_PROBE_REPORT (default
 * vrf-devnet-probe.md).
 *
 *   npx ts-node --project tsconfig.json --transpile-only scripts/vrfDevnetProbe.ts
 */
import fs from "node:fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

process.env.SWITCHBOARD_CLUSTER = "devnet";
process.env.RPC_URL = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
process.env.PROGRAM_ID ||= "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
process.env.TREASURY_PUBKEY ||= "11111111111111111111111111111111";
process.env.AUTHORITY_MODE = "read-only";
process.env.AUTHORITY_PUBKEY ||= "11111111111111111111111111111111";
// The production setting under test: the gateway gets no RPC URL.
delete process.env.SWITCHBOARD_GATEWAY_RPC_URL;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vrf = require("../src/lib/vrf") as typeof import("../src/lib/vrf");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseSecretKey } = require("../src/lib/settlerSigner") as typeof import("../src/lib/settlerSigner");

const MIN_BALANCE = 0.02 * LAMPORTS_PER_SOL;
const MAX_ORACLES = Math.max(1, Math.min(Number(process.env.VRF_PROBE_MAX_ORACLES) || 12, 32));
const REVEAL_ATTEMPTS = 12;
const REVEAL_RETRY_MS = 1_000;
const REPORT = process.env.VRF_PROBE_REPORT || "vrf-devnet-probe.md";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (key: PublicKey | string) => {
  const s = typeof key === "string" ? key : key.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};
const errorText = (error: unknown) => String((error as Error)?.message || error).replace(/\s+/g, " ").slice(0, 240);

// ---- every gateway request of this process, to prove no RPC URL is sent
type GatewayCall = { host: string; status: number | "error"; ms: number; bodyKeys: string[] };
const gatewayCalls: GatewayCall[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : String(input?.url ?? input);
  if (!url.includes("/gateway/api/v1/randomness_reveal")) return realFetch(input, init);
  let bodyKeys: string[] = [];
  try {
    bodyKeys = Object.keys(JSON.parse(String(init?.body ?? "{}")));
  } catch {
    bodyKeys = ["<unparsable>"];
  }
  const started = Date.now();
  try {
    const response = await realFetch(input, init);
    gatewayCalls.push({ host: new URL(url).host, status: response.status, ms: Date.now() - started, bodyKeys });
    return response;
  } catch (error) {
    gatewayCalls.push({ host: new URL(url).host, status: "error", ms: Date.now() - started, bodyKeys });
    throw error;
  }
}) as typeof fetch;

type OracleResult = {
  oracle: string;
  gateway: string;
  ok: boolean;
  step: string;
  error?: string;
  revealAttempts?: number;
  gatewayMs?: number;
  commitToRevealMs?: number;
  commitSlot?: number;
  revealSlot?: number;
  revealCu?: number;
};

const lines: string[] = [];
const log = (line = "") => {
  lines.push(line);
  console.log(line);
};
function writeReport(verdict: string) {
  const body = [`# Switchboard devnet probe: ${verdict}`, "", ...lines, ""].join("\n");
  fs.writeFileSync(REPORT, body);
}

function loadWallet(): { wallet: Keypair; source: string } {
  const raw = (process.env.DEVNET_PROBE_KEYPAIR || "").trim();
  if (raw) return { wallet: parseSecretKey(raw), source: "DEVNET_PROBE_KEYPAIR" };
  return { wallet: Keypair.generate(), source: "fresh (faucet)" };
}

async function fund(connection: Connection, wallet: Keypair): Promise<number> {
  let balance = await connection.getBalance(wallet.publicKey, "confirmed");
  for (const sol of [1, 0.2]) {
    if (balance >= MIN_BALANCE) break;
    try {
      const signature = await connection.requestAirdrop(wallet.publicKey, sol * LAMPORTS_PER_SOL);
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature, ...latest }, "confirmed");
      log(`- airdrop of ${sol} SOL: confirmed`);
    } catch (error) {
      log(`- airdrop of ${sol} SOL: failed (${errorText(error)})`);
    }
    balance = await connection.getBalance(wallet.publicKey, "confirmed");
  }
  return balance;
}

async function send(connection: Connection, ixs: TransactionInstruction[], signers: Keypair[]) {
  const signature = await sendAndConfirmTransaction(connection, new Transaction().add(...ixs), signers, {
    commitment: "confirmed",
  });
  let slot = 0;
  let cu: number | undefined;
  for (let i = 0; i < 5 && !slot; i += 1) {
    const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (tx) {
      slot = tx.slot;
      cu = tx.meta?.computeUnitsConsumed ?? undefined;
    } else {
      await sleep(500);
    }
  }
  return { signature, slot, cu };
}

async function main() {
  const connection = new Connection(process.env.RPC_URL!, "confirmed");
  const sbc = vrf.switchboard();
  const rpcHost = new URL(process.env.RPC_URL!).host;
  log(`- RPC: ${rpcHost}; Switchboard program ${sbc.programId.toBase58()}, queue ${sbc.queue.toBase58()}`);

  // ---- 1. oracle selection (read-only, runs even without funds)
  let inspected: Awaited<ReturnType<typeof vrf.inspectOracles>> | undefined;
  for (let attempt = 1; !inspected; attempt += 1) {
    try {
      inspected = await vrf.inspectOracles(connection);
    } catch (error) {
      if (attempt >= 3) throw error; // public devnet RPCs throttle: retry before giving up
      log(`- queue inspection failed (${errorText(error)}), retrying`);
      await sleep(5_000 * attempt);
    }
  }
  const { inspection, candidates } = inspected;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isRandomnessOracleCandidateEligible } = require("@switchboard-xyz/common");
  const disagreements: string[] = [];
  (inspection.candidates || []).forEach((entry: any, i: number) => {
    if (vrf.oracleEligible(candidates[i]) !== isRandomnessOracleCandidateEligible(entry)) {
      disagreements.push(candidates[i].oracle.toBase58());
    }
  });
  const eligible = candidates.filter(vrf.oracleEligible);
  const livePool = eligible.some((c) => c.liveHealthy) ? eligible.filter((c) => c.liveHealthy) : eligible;
  const majority = vrf.majorityVersion(livePool);
  const sdkMajority = inspection.metadata?.majorityVersion ?? null;
  const selected = await vrf.selectOracle(connection);
  const selectedCandidate = eligible.find((c) => c.oracle.equals(selected));
  const selectedEligible = Boolean(selectedCandidate);
  const selectedOnMajority = majority === null || (selectedCandidate?.version || "").trim() === majority;
  const reasons = new Map<string, string[]>(
    (inspection.metadata?.evaluations || []).map((e: any) => [String(e.oracleId), e.rejectionReasons || []]),
  );
  log(`- oracles on the queue: ${candidates.length}; eligible: ${eligible.length}; live-healthy eligible: ${eligible.filter((c) => c.liveHealthy).length}`);
  log(`- our eligibility rule vs the SDK's: ${disagreements.length ? `DISAGREE on ${disagreements.join(", ")}` : "identical on every candidate"}`);
  log(`- majority oracle version: ours ${majority ?? "-"}, SDK ${sdkMajority ?? "-"}; SDK's own pick ${inspection.selectedCandidate?.oracle?.pubkey?.toBase58?.() ?? "-"}`);
  log(`- selectOracle(): ${selected.toBase58()} (${selectedEligible ? "eligible" : "NOT ELIGIBLE"}, ${selectedOnMajority ? "majority version" : "NOT ON THE MAJORITY VERSION"})`);
  log("");
  log("| Oracle | Gateway | Version | Eligible | Live | SDK rejection reasons |");
  log("|---|---|---|---|---|---|");
  for (const c of candidates) {
    const host = c.gatewayUrl ? (() => { try { return new URL(c.gatewayUrl).host; } catch { return c.gatewayUrl; } })() : "-";
    log(`| ${short(c.oracle)} | ${host} | ${c.version || "-"} | ${vrf.oracleEligible(c) ? "yes" : "no"} | ${c.liveHealthy ? "yes" : "no"} | ${(reasons.get(c.oracle.toBase58()) || []).join(", ") || "-"} |`);
  }
  log("");
  const selectionOk = disagreements.length === 0 && selectedEligible && selectedOnMajority &&
    majority === sdkMajority && eligible.length > 0;

  // ---- 2. wallet
  const { wallet, source } = loadWallet();
  log(`- wallet ${wallet.publicKey.toBase58()} (${source})`);
  const balance = await fund(connection, wallet);
  log(`- balance ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (balance < MIN_BALANCE) {
    log("");
    log(`Round trips SKIPPED: the wallet holds less than ${MIN_BALANCE / LAMPORTS_PER_SOL} SOL and the faucet refused. ` +
      "Set the repository secret DEVNET_PROBE_KEYPAIR to a funded devnet keypair.");
    writeReport(selectionOk ? "SKIPPED (no devnet SOL); oracle selection OK" : "FAILED (oracle selection)");
    if (!selectionOk) process.exitCode = 1;
    return;
  }

  // ---- 3. one randomness account for all round trips
  const sb = await import("@switchboard-xyz/on-demand");
  const program: any = await sb.AnchorUtils.loadProgramFromConnection(connection as any, undefined, sbc.programId as any);
  const account = Keypair.generate();
  const [randomness, initIx] = await sb.Randomness.create(program, account as any, sbc.queue as any, wallet.publicKey as any);
  const before = await connection.getBalance(wallet.publicKey, "confirmed");
  await send(connection, [...vrf.vrfComputeBudget(), initIx as any], [wallet, account]);
  log(`- randomness account ${account.publicKey.toBase58()} created`);
  log("");

  // vrfReveal only needs a programId for the game-side PDAs it returns.
  const gameProgram = { programId: new PublicKey(process.env.PROGRAM_ID!) };
  const results: OracleResult[] = [];
  for (const candidate of eligible.slice(0, MAX_ORACLES)) {
    const result: OracleResult = {
      oracle: candidate.oracle.toBase58(),
      gateway: (() => { try { return new URL(candidate.gatewayUrl).host; } catch { return candidate.gatewayUrl; } })(),
      ok: false,
      step: "commit",
    };
    results.push(result);
    try {
      const commitIx = await randomness.commitIx(sbc.queue as any, wallet.publicKey as any, candidate.oracle as any);
      const commit = await send(connection, [commitIx as any], [wallet]);
      result.commitSlot = commit.slot;
      const committedAt = Date.now();

      result.step = "gateway";
      let revealed: Awaited<ReturnType<typeof vrf.vrfReveal>> | undefined;
      let lastError: unknown;
      // Retried like the settler does: a gateway that has not seen the seed slot
      // yet, or an RPC node behind the commit, fails the attempt.
      for (let attempt = 1; attempt <= REVEAL_ATTEMPTS && !revealed; attempt += 1) {
        result.revealAttempts = attempt;
        try {
          revealed = await vrf.vrfReveal(gameProgram, connection, account.publicKey, wallet.publicKey);
          result.gatewayMs = gatewayCalls[gatewayCalls.length - 1]?.ms;
        } catch (error) {
          lastError = error;
          await sleep(REVEAL_RETRY_MS);
        }
      }
      if (!revealed) throw lastError ?? new Error("no reveal");

      result.step = "reveal tx";
      const { params, accounts } = revealed;
      const revealIx: TransactionInstruction = program.instruction.randomnessReveal(
        { signature: Buffer.from(params.signature), recoveryId: params.recoveryId, value: params.value },
        {
          accounts: {
            randomness: account.publicKey,
            oracle: accounts.oracle,
            queue: accounts.queue,
            stats: accounts.stats,
            authority: wallet.publicKey,
            payer: wallet.publicKey,
            recentSlothashes: accounts.recentSlothashes,
            systemProgram: SystemProgram.programId,
            rewardEscrow: accounts.rewardEscrow,
            tokenProgram: TOKEN_PROGRAM_ID,
            wrappedSolMint: accounts.wrappedSolMint,
            programState: accounts.programState,
          },
        },
      );
      const reveal = await send(connection, [...vrf.vrfComputeBudget(), revealIx], [wallet]);
      result.revealSlot = reveal.slot;
      result.revealCu = reveal.cu;
      result.commitToRevealMs = Date.now() - committedAt;

      result.step = "read back";
      const info = await connection.getAccountInfo(account.publicKey, "confirmed");
      const data = vrf.parseRandomness(info!.data);
      if (data.revealSlot === 0n) throw new Error("reveal_slot is still 0");
      if (Buffer.compare(Buffer.from(data.value), Buffer.from(params.value)) !== 0) throw new Error("on-chain value differs from the gateway's");
      result.ok = true;
      result.step = "done";
    } catch (error) {
      result.error = errorText(error);
    }
  }

  // ---- 4. close the account (best effort)
  try {
    await send(connection, [(await randomness.closeIx()) as any], [wallet]);
    log(`- randomness account closed`);
  } catch (error) {
    log(`- close failed (${errorText(error)}); the account stays on devnet`);
  }
  const after = await connection.getBalance(wallet.publicKey, "confirmed");
  log(`- spent ${((before - after) / LAMPORTS_PER_SOL).toFixed(6)} SOL on ${results.length} round trips`);
  log("");

  log("| Oracle | Gateway | Result | Reveal attempts | Gateway ms | Commit→reveal ms | Slots | Reveal CU |");
  log("|---|---|---|---:|---:|---:|---:|---:|");
  for (const r of results) {
    const slots = r.commitSlot && r.revealSlot ? r.revealSlot - r.commitSlot : "";
    log(`| ${short(r.oracle)} | ${r.gateway} | ${r.ok ? "ok" : `FAILED at ${r.step}: ${r.error}`} | ${r.revealAttempts ?? ""} | ${r.gatewayMs ?? ""} | ${r.commitToRevealMs ?? ""} | ${slots} | ${r.revealCu ?? ""} |`);
  }
  log("");
  const leaked = gatewayCalls.filter((c) => c.bodyKeys.includes("rpc"));
  const served = gatewayCalls.filter((c) => c.status === 200).map((c) => c.ms).sort((a, b) => a - b);
  log(`- gateway requests: ${gatewayCalls.length}; with an \`rpc\` field: ${leaked.length}; ` +
    `HTTP 200 latency p50 ${served.length ? served[Math.floor(served.length / 2)] : "-"} ms, max ${served.length ? served[served.length - 1] : "-"} ms`);

  const ok = results.filter((r) => r.ok).length;
  const passed = selectionOk && leaked.length === 0 && ok > 0;
  const verdict = passed
    ? `PASSED: ${ok} of ${results.length} eligible oracles completed a round trip without an RPC URL`
    : `FAILED: ${ok} of ${results.length} round trips${leaked.length ? ", rpc field sent" : ""}${selectionOk ? "" : ", oracle selection"}`;
  log(`- ${verdict}`);
  writeReport(verdict);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  log(`- probe crashed: ${errorText(error)}`);
  writeReport("FAILED (crash)");
  process.exitCode = 1;
});
