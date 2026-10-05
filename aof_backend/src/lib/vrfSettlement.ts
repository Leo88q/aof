/**
 * [F-06] Settlement builders for every Switchboard-backed mechanic.
 *
 * One place knows the account layout of each commit / reveal / refund
 * instruction, so the HTTP routes (commit + player self-settlement) and the
 * vrf-settler worker (automatic reveal + refund) cannot drift apart. The
 * on-chain programs re-check every account, so a mistake here fails closed.
 */
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { program, questsProgram, connection } from "../provider";
import {
  authPda,
  configPda,
  drumCommitPda,
  enchantSlotPda,
  issuanceCapPda,
  materialMintsPda,
  packMintPda,
  questConfigPda,
  rerollMintPda,
  resourceEscrowAta,
  toolPda,
} from "./pda";
import { VRF_REFUND_AFTER_SLOTS, vrfComputeBudget, vrfReveal, vrfSlotPda } from "./vrf";
import { coSign } from "./tx";
import { coSignWithVrfLookupTable } from "./vrfLookupTableTransactions";

export type Mechanic = "pack" | "reroll" | "exploration" | "forge" | "lottery" | "drum";
export const MECHANICS: Mechanic[] = ["pack", "reroll", "exploration", "forge", "lottery", "drum"];

export type PendingCommit = {
  mechanic: Mechanic;
  address: PublicKey;
  /** The paying player (for a lottery draw: none — the round itself). */
  user: PublicKey | null;
  randomness: PublicKey;
  seedSlot: number;
  commitSlot: number;
  account: any;
};

export type CommitPhase = "revealable" | "refundable";

/** Pure: which settlement path is open at `currentSlot` (never both). */
export function commitPhase(commitSlot: number, currentSlot: number): CommitPhase {
  return currentSlot < commitSlot + VRF_REFUND_AFTER_SLOTS ? "revealable" : "refundable";
}

const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

async function coreConfig(): Promise<any> {
  return (program.account as any).config.fetch(configPda()[0]);
}

async function materialMints(): Promise<any> {
  return (program.account as any).materialMints.fetch(materialMintsPda()[0]);
}

function programFor(mechanic: Mechanic): any {
  return mechanic === "drum" ? questsProgram : program;
}

// ---------------------------------------------------------------- discovery

export async function listPendingCommits(mechanics: Mechanic[] = MECHANICS): Promise<PendingCommit[]> {
  const out: PendingCommit[] = [];
  const push = (mechanic: Mechanic, rows: Array<{ publicKey: PublicKey; account: any }>, user: (a: any) => PublicKey | null,
    commitSlot: (a: any) => number) => {
    for (const { publicKey, account } of rows) {
      out.push({
        mechanic,
        address: publicKey,
        user: user(account),
        randomness: account.randomness,
        seedSlot: Number(account.seedSlot),
        commitSlot: commitSlot(account),
        account,
      });
    }
  };
  const acc = program.account as any;
  for (const mechanic of mechanics) {
    if (mechanic === "pack") push(mechanic, await acc.packCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));
    if (mechanic === "reroll") push(mechanic, await acc.rerollCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));
    if (mechanic === "exploration") push(mechanic, await acc.explorationCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));
    if (mechanic === "forge") push(mechanic, await acc.forgeCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));
    if (mechanic === "lottery") {
      const rounds: Array<{ publicKey: PublicKey; account: any }> = await acc.lotteryRound.all();
      push(mechanic, rounds.filter((r) => r.account.drawCommitted && !r.account.drawn), () => null, (a) => Number(a.drawCommitSlot));
    }
    if (mechanic === "drum") {
      push(mechanic, await (questsProgram.account as any).drumCommit.all(), (a) => a.user, (a) => Number(a.commitSlot));
    }
  }
  return out;
}

export async function fetchPendingCommit(mechanic: Mechanic, address: PublicKey): Promise<PendingCommit | null> {
  const names: Record<Mechanic, string> = {
    pack: "packCommit", reroll: "rerollCommit", exploration: "explorationCommit", forge: "forgeCommit",
    lottery: "lotteryRound", drum: "drumCommit",
  };
  const account = await (programFor(mechanic).account as any)[names[mechanic]].fetchNullable(address);
  if (!account) return null;
  if (mechanic === "lottery" && (!account.drawCommitted || account.drawn)) return null;
  return {
    mechanic,
    address,
    user: mechanic === "lottery" ? null : account.user,
    randomness: account.randomness,
    seedSlot: Number(account.seedSlot),
    commitSlot: Number(mechanic === "lottery" ? account.drawCommitSlot : account.commitSlot),
    account,
  };
}

// ---------------------------------------------------------------- reveal

/** Compute budget + the program's reveal instruction, settled by `cranker`. */
export async function buildRevealInstructions(c: PendingCommit, cranker: PublicKey): Promise<TransactionInstruction[]> {
  const prog = programFor(c.mechanic);
  const { params, accounts: vrf } = await vrfReveal(prog, connection, c.randomness, cranker);
  const common = {
    ...vrf,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
  const withAta = { ...common, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID };
  const config = configPda()[0];
  const a = c.account;
  let ix: TransactionInstruction;
  switch (c.mechanic) {
    case "pack": {
      const cfg = await coreConfig();
      const [mint] = packMintPda(c.address);
      ix = await (program.methods as any).packOpenReveal(params).accounts({
        config, cranker, packCommit: c.address, user: a.user, treasury: cfg.treasury,
        mint, userToken: ata(mint, a.user), toolData: toolPda(mint)[0], auth: authPda()[0], ...withAta,
      }).instruction();
      break;
    }
    case "reroll": {
      const cfg = await coreConfig();
      const [newMint] = rerollMintPda(c.address);
      ix = await (program.methods as any).rerollRandomReveal(params).accounts({
        config, cranker, rerollCommit: c.address, user: a.user, treasury: cfg.treasury,
        newMint, newToken: ata(newMint, a.user), newToolData: toolPda(newMint)[0], auth: authPda()[0], ...withAta,
      }).instruction();
      break;
    }
    case "exploration": {
      const cfg = await coreConfig();
      const mm = await materialMints();
      ix = await (program.methods as any).exploreReveal(params).accounts({
        config, materialMints: materialMintsPda()[0], cranker, explorationCommit: c.address, user: a.user,
        dataMint: cfg.dataMint, datasetMint: mm.dataset,
        circuitMint: cfg.circuitMint, userCircuit: ata(cfg.circuitMint, a.user),
        siliconMint: cfg.siliconMint, userSilicon: ata(cfg.siliconMint, a.user), auth: authPda()[0],
        escrowData: resourceEscrowAta(cfg.dataMint), escrowCircuit: resourceEscrowAta(cfg.circuitMint),
        escrowSilicon: resourceEscrowAta(cfg.siliconMint), escrowDataset: resourceEscrowAta(mm.dataset),
        issuanceCapCircuit: issuanceCapPda("circuit")[0], issuanceCapSilicon: issuanceCapPda("silicon")[0],
        ...withAta,
      }).instruction();
      break;
    }
    case "forge": {
      const cfg = await coreConfig();
      ix = await (program.methods as any).forgeAttemptReveal(params).accounts({
        config, cranker, enchantSlot: enchantSlotPda(a.toolMint, Number(a.slotType))[0], forgeCommit: c.address,
        user: a.user, treasury: cfg.treasury, auth: authPda()[0],
        circuitMint: cfg.circuitMint, escrowCircuit: resourceEscrowAta(cfg.circuitMint),
        siliconMint: cfg.siliconMint, escrowSilicon: resourceEscrowAta(cfg.siliconMint), ...common,
      }).instruction();
      break;
    }
    case "lottery": {
      const cfg = await coreConfig();
      ix = await (program.methods as any).drawLottery(params).accounts({
        config, cranker, lotteryRound: c.address, treasury: cfg.treasury, ...common,
      }).instruction();
      break;
    }
    case "drum": {
      const [questConfig] = questConfigPda();
      const qc: any = await (questsProgram.account as any).questConfig.fetch(questConfig);
      ix = await (questsProgram.methods as any).drumReveal(params).accounts({
        drumCommit: c.address, questConfig, cranker, user: a.user, treasuryMascot: qc.treasuryMascot,
        mascotMint: qc.mascotMint, userMascot: ata(qc.mascotMint, a.user), ...withAta,
      }).instruction();
      break;
    }
  }
  return [...vrfComputeBudget(), ix];
}

// ---------------------------------------------------------------- refund

/** The permissionless refund of a commit whose reveal window has closed. */
export async function buildRefundInstructions(c: PendingCommit, cranker: PublicKey): Promise<TransactionInstruction[]> {
  const ataSetup = await buildMissingRefundAtaInstructions(c, cranker);
  return [...vrfComputeBudget(), ...ataSetup, await refundInstruction(c)];
}

/**
 * Expired exploration/forge commits refund escrowed SPL resources. If a player
 * closed an ATA after committing, create it as a top-level idempotent ATA ix,
 * paid by the refund transaction's fee payer. Keeping account creation outside
 * aof_core's SBF frame avoids another init CPI there and makes player self-settle
 * and third-party settlement use the same refund-safe path.
 */
async function buildMissingRefundAtaInstructions(c: PendingCommit, payer: PublicKey): Promise<TransactionInstruction[]> {
  if (c.mechanic !== "exploration" && c.mechanic !== "forge") return [];
  if (!c.user) throw new Error(`${c.mechanic} refund is missing its committing user`);
  const cfg = await coreConfig();
  const mints = c.mechanic === "exploration"
    ? [cfg.dataMint, cfg.circuitMint, cfg.siliconMint, (await materialMints()).dataset as PublicKey]
    : [cfg.circuitMint, cfg.siliconMint];
  const addresses = mints.map((mint: PublicKey) => ata(mint, c.user!));
  const infos = await connection.getMultipleAccountsInfo(addresses, "confirmed");
  const instructions: TransactionInstruction[] = [];
  for (let i = 0; i < mints.length; i++) {
    const info = infos[i];
    if (info) {
      if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
        throw new Error(`${c.mechanic} refund ATA ${addresses[i].toBase58()} is owned by ${info.owner.toBase58()}, not SPL Token`);
      }
      continue;
    }
    instructions.push(createAssociatedTokenAccountIdempotentInstruction(
      payer, addresses[i], c.user, mints[i], TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
  }
  return instructions;
}

async function refundInstruction(c: PendingCommit): Promise<TransactionInstruction> {
  const prog = programFor(c.mechanic);
  const vrfSlot = vrfSlotPda(prog.programId, c.randomness);
  const config = configPda()[0];
  const a = c.account;
  const withAta = {
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
  switch (c.mechanic) {
    case "pack":
      return await (program.methods as any).packOpenExpire().accounts({
        config, packCommit: c.address, user: a.user, vrfSlot,
      }).instruction();
    case "reroll": {
      const [newMint] = rerollMintPda(c.address);
      return await (program.methods as any).rerollRandomExpire().accounts({
        config, cranker, rerollCommit: c.address, user: a.user, vrfSlot,
        newMint, newToken: ata(newMint, a.user), newToolData: toolPda(newMint)[0], auth: authPda()[0], ...withAta,
      }).instruction();
    }
    case "exploration": {
      const cfg = await coreConfig();
      const mm = await materialMints();
      // Refunds go to the player's existing canonical ATAs (see ExploreExpire).
      return await (program.methods as any).exploreExpire().accounts({
        config, materialMints: materialMintsPda()[0], explorationCommit: c.address, user: a.user, vrfSlot,
        auth: authPda()[0],
        dataMint: cfg.dataMint, userData: ata(cfg.dataMint, a.user), escrowData: resourceEscrowAta(cfg.dataMint),
        circuitMint: cfg.circuitMint, userCircuit: ata(cfg.circuitMint, a.user), escrowCircuit: resourceEscrowAta(cfg.circuitMint),
        siliconMint: cfg.siliconMint, userSilicon: ata(cfg.siliconMint, a.user), escrowSilicon: resourceEscrowAta(cfg.siliconMint),
        datasetMint: mm.dataset, userDataset: ata(mm.dataset, a.user), escrowDataset: resourceEscrowAta(mm.dataset),
        tokenProgram: TOKEN_PROGRAM_ID,
      }).instruction();
    }
    case "forge": {
      const cfg = await coreConfig();
      return await (program.methods as any).forgeAttemptExpire().accounts({
        config, forgeCommit: c.address, user: a.user, vrfSlot,
        auth: authPda()[0], circuitMint: cfg.circuitMint, userCircuit: ata(cfg.circuitMint, a.user),
        escrowCircuit: resourceEscrowAta(cfg.circuitMint),
        siliconMint: cfg.siliconMint, userSilicon: ata(cfg.siliconMint, a.user),
        escrowSilicon: resourceEscrowAta(cfg.siliconMint), tokenProgram: TOKEN_PROGRAM_ID,
      }).instruction();
    }
    case "lottery":
      return await (program.methods as any).expireLotteryDraw().accounts({
        config, lotteryRound: c.address, vrfSlot,
      }).instruction();
    case "drum": {
      const [questConfig] = questConfigPda();
      const qc: any = await (questsProgram.account as any).questConfig.fetch(questConfig);
      return await (questsProgram.methods as any).drumExpire().accounts({
        drumCommit: c.address, questConfig, cranker, user: a.user, treasuryMascot: qc.treasuryMascot,
        mascotMint: qc.mascotMint, userMascot: ata(qc.mascotMint, a.user), vrfSlot, ...withAta,
      }).instruction();
    }
  }
}

export type DrumOutcome =
  | { state: "settled"; prize: number; signature: string; value: string }
  | { state: "refunded"; amount: number; signature: string }
  | { state: "none" };

/**
 * Drum outcome in one transaction's logs. The drum pays mascots instead of
 * minting an NFT, so once its (per-user, reused) commit PDA is closed the
 * result only lives in events: DrumRevealed carries the prize and the oracle
 * value (anyone can recompute drum_prize), DrumRefunded the refunded price.
 * "committed" marks a newer spin that is not settled yet.
 */
export function drumOutcomeFromLogs(logs: string[], signature: string, parser: { parseLogs(logs: string[]): Iterable<{ name: string; data: any }> }): DrumOutcome | "committed" | null {
  for (const ev of parser.parseLogs(logs)) {
    const name = ev.name.charAt(0).toUpperCase() + ev.name.slice(1);
    if (name === "DrumRevealed") {
      return { state: "settled", prize: Number(ev.data.prize), signature, value: Buffer.from(ev.data.value).toString("hex") };
    }
    if (name === "DrumRefunded") return { state: "refunded", amount: Number(ev.data.amount), signature };
    if (name === "DrumCommitted") return "committed";
  }
  return null;
}

/** Where the settlement NFT of a tool-producing commit lives (for status APIs). */
export function settlementMint(mechanic: Mechanic, commit: PublicKey): PublicKey | null {
  if (mechanic === "pack") return packMintPda(commit)[0];
  if (mechanic === "reroll") return rerollMintPda(commit)[0];
  return null;
}

export function drumCommitAddress(user: PublicKey): PublicKey {
  return drumCommitPda(user)[0];
}

export function toBn(value: string | number | bigint): BN {
  return new BN(value.toString());
}

// ---------------------------------------------------------------- player-facing helpers


/**
 * Transaction that lets the PLAYER settle (or, after the window, refund) a
 * commit: the player is the cranker and fee payer, the backend signs nothing.
 * This is the "don't trust our crank" path of provable fairness: even if the
 * backend never settles, the player can.
 */
export async function selfSettleTransaction(mechanic: Mechanic, address: PublicKey, player: PublicKey): Promise<{ tx: string; phase: CommitPhase }> {
  const commit = await fetchPendingCommit(mechanic, address);
  if (!commit) {
    const error = new Error("COMMIT_ALREADY_SETTLED");
    (error as { status?: number }).status = 409;
    throw error;
  }
  if (commit.user && !commit.user.equals(player)) {
    const error = new Error("Commit belongs to another wallet");
    (error as { status?: number }).status = 403;
    throw error;
  }
  const phase = commitPhase(commit.commitSlot, await connection.getSlot("confirmed"));
  const ixs = phase === "revealable"
    ? await buildRevealInstructions(commit, player)
    : await buildRefundInstructions(commit, player);
  const tx = mechanic === "exploration"
    ? await coSignWithVrfLookupTable(ixs, player)
    : await coSign(ixs, player);
  return { tx, phase };
}

export type CommitStatus =
  | { state: "pending"; phase: CommitPhase; commitSlot: number; currentSlot: number; refundAfterSlot: number }
  | { state: "settled" | "refunded" | "unknown"; mint?: string; tool?: { toolType: string; rarity: string; durability: number } };

const RARITY_NAMES = ["common", "uncommon", "rare", "epic", "legendary"];

function rarityName(v: any): string {
  if (typeof v === "number") return RARITY_NAMES[v] || String(v);
  return RARITY_NAMES.find((name) => v && typeof v === "object" && name in v) || "unknown";
}

/** Pending / settled / refunded, from chain state only. */
export async function commitStatus(mechanic: Mechanic, address: PublicKey): Promise<CommitStatus> {
  const pending = await fetchPendingCommit(mechanic, address);
  if (pending) {
    const currentSlot = await connection.getSlot("confirmed");
    return {
      state: "pending",
      phase: commitPhase(pending.commitSlot, currentSlot),
      commitSlot: pending.commitSlot,
      currentSlot,
      refundAfterSlot: pending.commitSlot + VRF_REFUND_AFTER_SLOTS,
    };
  }
  const mint = settlementMint(mechanic, address);
  if (!mint) return { state: "unknown" };
  const tool: any = await (program.account as any).toolData.fetchNullable(toolPda(mint)[0]);
  if (!tool) return { state: "refunded" };
  return {
    state: "settled",
    mint: mint.toBase58(),
    tool: { toolType: tool.toolType, rarity: rarityName(tool.rarity), durability: Number(tool.durability) },
  };
}
