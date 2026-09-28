/**
 * [F-06] Offline self-test of src/lib/vrfSettlement.ts — the one module that
 * knows the account layout of every commit / reveal / refund instruction of
 * the six Switchboard-backed mechanics (packs, random reroll, expeditions,
 * forge, lottery, drum).
 *
 * nf-mutate (2026-09-28) scored this module at 38 %: the per-mechanic
 * discovery (`if (mechanic === …)`), the lottery filter, the off-curve ATA
 * flag and every `[0]`-vs-bump index in the account wiring survived, because
 * the only coverage was the devnet probe. This test stubs the Anchor account
 * clients, the Switchboard reveal and the co-signer, then checks each built
 * instruction account-by-account against the committed IDL — so a wrong or
 * swapped account in a reveal/refund transaction fails here, not on chain.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";

process.env.PROGRAM_ID ||= "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
process.env.TREASURY_PUBKEY ||= "11111111111111111111111111111111";
process.env.AUTHORITY_MODE = "read-only";
delete process.env.AUTHORITY_SECRET_KEY;
delete process.env.AUTHORITY_SECRET_KEY_FILE;
delete process.env.ALLOW_HOT_AUTHORITY_KEY;
process.env.AUTHORITY_PUBKEY ||= "11111111111111111111111111111111";

/* eslint-disable @typescript-eslint/no-var-requires */
const { program, questsProgram, connection } = require("../src/provider");
const vrfModule = require("../src/lib/vrf") as typeof import("../src/lib/vrf");
const txModule = require("../src/lib/tx") as typeof import("../src/lib/tx");
const pda = require("../src/lib/pda") as typeof import("../src/lib/pda");
/* eslint-enable @typescript-eslint/no-var-requires */

const k = (seed: number) => new PublicKey(Buffer.alloc(32, seed));
const SYSTEM = new PublicKey("11111111111111111111111111111111");
const CORE = program.programId as PublicKey;
const QUESTS = questsProgram.programId as PublicKey;

// ---------------------------------------------------------------- stubs
type Row = { publicKey: PublicKey; account: any };
const calls: Record<string, number> = {};
function stub(client: any, name: string, rows: () => Row[]) {
  const count = () => { calls[name] = (calls[name] || 0) + 1; };
  client.all = async () => { count(); return rows(); };
  client.fetchNullable = async (address: PublicKey) => { count(); return rows().find((r) => r.publicKey.equals(address))?.account ?? null; };
  client.fetch = async (address: PublicKey) => {
    count();
    const row = rows().find((r) => r.publicKey.equals(address));
    if (!row) throw new Error(`Account does not exist ${address.toBase58()}`);
    return row.account;
  };
}

const wallet = Keypair.generate().publicKey;                                  // on-curve player
const vaultUser = PublicKey.findProgramAddressSync([Buffer.from("vault")], k(33))[0]; // off-curve player (program-owned wallet)
const cfg = { treasury: k(50), woodMint: k(51), stoneMint: k(52), foodMint: k(53) };
const mm = { meat: k(54) };
const qc = { treasuryMascot: k(60), mascotMint: k(61) };
const bn = (n: number) => new BN(n);

const commits = {
  pack: { publicKey: k(1), account: { user: wallet, randomness: k(71), seedSlot: bn(1_000), commitSlot: bn(1_001) } },
  reroll: { publicKey: k(2), account: { user: vaultUser, randomness: k(72), seedSlot: bn(2_000), commitSlot: bn(2_001) } },
  exploration: { publicKey: k(3), account: { user: wallet, randomness: k(73), seedSlot: bn(3_000), commitSlot: bn(3_001) } },
  forge: { publicKey: k(4), account: { user: wallet, randomness: k(74), seedSlot: bn(4_000), commitSlot: bn(4_001), toolMint: k(80), slotType: 2 } },
  lottery: { publicKey: k(5), account: { drawCommitted: true, drawn: false, randomness: k(75), seedSlot: bn(5_000), drawCommitSlot: bn(5_001) } },
  drum: { publicKey: k(6), account: { user: wallet, randomness: k(76), seedSlot: bn(6_000), commitSlot: bn(6_001) } },
};
const lotteryNoise: Row[] = [
  { publicKey: k(15), account: { drawCommitted: false, drawn: false, randomness: k(85), seedSlot: bn(0), drawCommitSlot: bn(0) } },
  { publicKey: k(16), account: { drawCommitted: true, drawn: true, randomness: k(86), seedSlot: bn(1), drawCommitSlot: bn(2) } },
];
let live: Record<string, Row[]> = {};
const reset = () => {
  live = {
    packCommit: [commits.pack], rerollCommit: [commits.reroll], explorationCommit: [commits.exploration],
    forgeCommit: [commits.forge], lotteryRound: [lotteryNoise[0], commits.lottery, lotteryNoise[1]], drumCommit: [commits.drum],
    toolData: [],
  };
  for (const key of Object.keys(calls)) delete calls[key];
};
reset();
for (const name of ["packCommit", "rerollCommit", "explorationCommit", "forgeCommit", "lotteryRound", "toolData"]) {
  stub(program.account[name], name, () => live[name]);
}
stub(program.account.config, "config", () => [{ publicKey: pda.configPda()[0], account: cfg }]);
stub(program.account.materialMints, "materialMints", () => [{ publicKey: pda.materialMintsPda()[0], account: mm }]);
stub(questsProgram.account.drumCommit, "drumCommit", () => live.drumCommit);
stub(questsProgram.account.questConfig, "questConfig", () => [{ publicKey: pda.questConfigPda()[0], account: qc }]);

// Switchboard reveal: deterministic params + accounts, no gateway, no RPC.
const revealParams = { signature: Array(64).fill(1), recoveryId: 0, value: Array(32).fill(2) };
const sbAccounts = (prog: any, randomness: PublicKey) => ({
  vrfSlot: vrfModule.vrfSlotPda(prog.programId, randomness), randomness, vrfAuthority: k(90), oracle: k(91), queue: k(92),
  stats: k(93), recentSlothashes: k(94), rewardEscrow: k(95), wrappedSolMint: k(96), programState: k(97), switchboardProgram: k(98),
});
let revealCalls: Array<{ program: PublicKey; randomness: PublicKey; cranker: PublicKey }> = [];
(vrfModule as any).vrfReveal = async (prog: any, _c: unknown, randomness: PublicKey, cranker: PublicKey) => {
  revealCalls.push({ program: prog.programId, randomness, cranker });
  return { params: revealParams, accounts: sbAccounts(prog, randomness) };
};
let currentSlot = 1_500;
(connection as any).getSlot = async () => currentSlot;
let coSigned: { count: number; payer: string; lastDisc: string } | null = null;
(txModule as any).coSign = async (ixs: TransactionInstruction[], payer: PublicKey) => {
  coSigned = { count: ixs.length, payer: payer.toBase58(), lastDisc: Buffer.from(ixs[ixs.length - 1].data.subarray(0, 8)).toString("hex") };
  return "base64-tx";
};

// The module under test is loaded AFTER the stubs so it binds to them.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const settlement = require("../src/lib/vrfSettlement") as typeof import("../src/lib/vrfSettlement");
type Mechanic = import("../src/lib/vrfSettlement").Mechanic;

const disc = (prog: any, ix: string) => Buffer.from(prog.idl.instructions.find((i: any) => i.name === ix).discriminator).toString("hex");
const idlAccounts = (prog: any, ix: string): string[] => prog.idl.instructions.find((i: any) => i.name === ix).accounts.map((a: any) => a.name);
const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

/** Every IDL account of `ixName`, in order, must be exactly what the builder wired. */
function expectWiring(prog: any, ix: TransactionInstruction, ixName: string, expected: Record<string, PublicKey>) {
  assert.ok(ix.programId.equals(prog.programId), `${ixName}: program id`);
  assert.equal(Buffer.from(ix.data.subarray(0, 8)).toString("hex"), disc(prog, ixName), `${ixName}: discriminator`);
  const names = idlAccounts(prog, ixName);
  assert.equal(ix.keys.length, names.length, `${ixName}: account count`);
  names.forEach((name, i) => {
    assert.ok(expected[name], `${ixName}: test has no expectation for IDL account "${name}"`);
    assert.ok(ix.keys[i].pubkey.equals(expected[name]), `${ixName}: account #${i} ${name} = ${ix.keys[i].pubkey.toBase58()}, expected ${expected[name].toBase58()}`);
  });
  for (const name of Object.keys(expected)) assert.ok(names.includes(name), `${ixName}: expectation "${name}" is not an IDL account`);
}

(async () => {
  // ---- discovery: one pending commit per mechanic, from the right program, with the right fields
  {
    const all = await settlement.listPendingCommits();
    assert.deepEqual(all.map((c) => c.mechanic), settlement.MECHANICS, "every mechanic is scanned in MECHANICS order");
    const byMech = Object.fromEntries(all.map((c) => [c.mechanic, c])) as Record<Mechanic, any>;
    assert.ok(byMech.pack.address.equals(k(1)) && byMech.pack.user.equals(wallet) && byMech.pack.randomness.equals(k(71)));
    assert.equal(byMech.pack.seedSlot, 1_000);
    assert.equal(byMech.pack.commitSlot, 1_001);
    assert.ok(byMech.reroll.user.equals(vaultUser));
    assert.equal(byMech.exploration.commitSlot, 3_001);
    assert.equal(byMech.forge.account.slotType, 2);
    assert.equal(byMech.lottery.user, null, "a lottery draw has no paying player");
    assert.equal(byMech.lottery.commitSlot, 5_001, "lottery uses drawCommitSlot");
    assert.ok(byMech.lottery.address.equals(k(5)), "only the committed-and-not-drawn round is pending");
    assert.ok(byMech.drum.address.equals(k(6)) && byMech.drum.randomness.equals(k(76)));
    assert.equal(calls.drumCommit, 1, "drum commits come from the quests program");
    assert.equal(calls.lotteryRound, 1);

    reset();
    const packsOnly = await settlement.listPendingCommits(["pack"]);
    assert.deepEqual(packsOnly.map((c) => c.mechanic), ["pack"]);
    assert.deepEqual(calls, { packCommit: 1 }, "a filtered scan touches only the requested account type");

    reset();
    const two = await settlement.listPendingCommits(["drum", "lottery"]);
    assert.deepEqual(two.map((c) => c.mechanic), ["drum", "lottery"], "order follows the caller's list");
    assert.deepEqual(Object.keys(calls).sort(), ["drumCommit", "lotteryRound"]);

    reset();
    live.lotteryRound = lotteryNoise;
    assert.deepEqual(await settlement.listPendingCommits(["lottery"]), [], "not-committed and already-drawn rounds are never pending");
    reset();
  }

  // ---- single-commit lookup
  {
    const pack = await settlement.fetchPendingCommit("pack", k(1));
    assert.ok(pack && pack.user!.equals(wallet) && pack.commitSlot === 1_001 && pack.seedSlot === 1_000 && pack.randomness.equals(k(71)));
    assert.equal(await settlement.fetchPendingCommit("pack", k(99)), null, "unknown address");
    const lottery = await settlement.fetchPendingCommit("lottery", k(5));
    assert.ok(lottery && lottery.user === null && lottery.commitSlot === 5_001 && lottery.seedSlot === 5_000);
    assert.equal(await settlement.fetchPendingCommit("lottery", k(15)), null, "draw not committed");
    assert.equal(await settlement.fetchPendingCommit("lottery", k(16)), null, "already drawn");
    const drum = await settlement.fetchPendingCommit("drum", k(6));
    assert.ok(drum && drum.user!.equals(wallet) && drum.commitSlot === 6_001);
    assert.equal(await settlement.fetchPendingCommit("drum", k(1)), null, "a core pack commit is not a drum commit");
  }

  // ---- reveal wiring, mechanic by mechanic, against the committed IDL
  const cranker = k(40);
  const config = pda.configPda()[0];
  const auth = pda.authPda()[0];
  const materialMints = pda.materialMintsPda()[0];
  const sb = (prog: any, randomness: PublicKey) => ({ ...sbAccounts(prog, randomness), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SYSTEM });
  const sbAta = (prog: any, randomness: PublicKey) => ({ ...sb(prog, randomness), associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID });
  async function reveal(mechanic: Mechanic) {
    revealCalls = [];
    const commit = (await settlement.fetchPendingCommit(mechanic, commits[mechanic].publicKey))!;
    const ixs = await settlement.buildRevealInstructions(commit, cranker);
    const budget = vrfModule.vrfComputeBudget();
    assert.equal(ixs.length, budget.length + 1, `${mechanic}: compute budget + one reveal instruction`);
    budget.forEach((b, i) => assert.ok(ixs[i].programId.equals(b.programId) && Buffer.compare(ixs[i].data, b.data) === 0, `${mechanic}: compute budget #${i}`));
    assert.equal(revealCalls.length, 1);
    assert.ok(revealCalls[0].randomness.equals(commits[mechanic].account.randomness) && revealCalls[0].cranker.equals(cranker));
    return ixs[ixs.length - 1];
  }
  {
    const mint = pda.packMintPda(k(1))[0];
    expectWiring(program, await reveal("pack"), "packOpenReveal", {
      config, cranker, packCommit: k(1), user: wallet, treasury: cfg.treasury, mint, userToken: ata(mint, wallet),
      toolData: pda.toolPda(mint)[0], auth, ...sbAta(program, k(71)),
    });
    assert.ok(revealCalls[0].program.equals(CORE));
  }
  {
    const newMint = pda.rerollMintPda(k(2))[0];
    // vaultUser is off-curve: the builder must allow owner-off-curve ATAs (program-owned wallets play too).
    assert.throws(() => getAssociatedTokenAddressSync(newMint, vaultUser, false), /TokenOwnerOffCurveError/);
    expectWiring(program, await reveal("reroll"), "rerollRandomReveal", {
      config, cranker, rerollCommit: k(2), user: vaultUser, treasury: cfg.treasury, newMint, newToken: ata(newMint, vaultUser),
      newToolData: pda.toolPda(newMint)[0], auth, ...sbAta(program, k(72)),
    });
  }
  expectWiring(program, await reveal("exploration"), "exploreReveal", {
    config, materialMints, cranker, explorationCommit: k(3), user: wallet, woodMint: cfg.woodMint, userWood: ata(cfg.woodMint, wallet),
    stoneMint: cfg.stoneMint, userStone: ata(cfg.stoneMint, wallet), auth, ...sbAta(program, k(73)),
  });
  expectWiring(program, await reveal("forge"), "forgeAttemptReveal", {
    config, cranker, enchantSlot: pda.enchantSlotPda(k(80), 2)[0], forgeCommit: k(4), user: wallet, treasury: cfg.treasury, ...sb(program, k(74)),
  });
  expectWiring(program, await reveal("lottery"), "drawLottery", { config, cranker, lotteryRound: k(5), treasury: cfg.treasury, ...sb(program, k(75)) });
  {
    const ix = await reveal("drum");
    assert.ok(revealCalls[0].program.equals(QUESTS), "drum randomness lives in the quests program");
    expectWiring(questsProgram, ix, "drumReveal", {
      drumCommit: k(6), questConfig: pda.questConfigPda()[0], cranker, user: wallet, treasuryMascot: qc.treasuryMascot,
      mascotMint: qc.mascotMint, userMascot: ata(qc.mascotMint, wallet), ...sbAta(questsProgram, k(76)),
    });
  }

  // ---- refund wiring (permissionless expire after the reveal window)
  async function refund(mechanic: Mechanic) {
    const commit = (await settlement.fetchPendingCommit(mechanic, commits[mechanic].publicKey))!;
    const ixs = await settlement.buildRefundInstructions(commit, cranker);
    assert.equal(ixs.length, vrfModule.vrfComputeBudget().length + 1, `${mechanic}: compute budget + one refund instruction`);
    return ixs[ixs.length - 1];
  }
  const slot = (prog: any, randomness: PublicKey) => vrfModule.vrfSlotPda(prog.programId, randomness);
  expectWiring(program, await refund("pack"), "packOpenExpire", { config, packCommit: k(1), user: wallet, vrfSlot: slot(program, k(71)) });
  {
    const newMint = pda.rerollMintPda(k(2))[0];
    expectWiring(program, await refund("reroll"), "rerollRandomExpire", {
      config, cranker, rerollCommit: k(2), user: vaultUser, vrfSlot: slot(program, k(72)), newMint, newToken: ata(newMint, vaultUser),
      newToolData: pda.toolPda(newMint)[0], auth, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SYSTEM,
    });
  }
  expectWiring(program, await refund("exploration"), "exploreExpire", {
    config, materialMints, explorationCommit: k(3), user: wallet, vrfSlot: slot(program, k(73)), auth,
    foodMint: cfg.foodMint, userFood: ata(cfg.foodMint, wallet), woodMint: cfg.woodMint, userWood: ata(cfg.woodMint, wallet),
    stoneMint: cfg.stoneMint, userStone: ata(cfg.stoneMint, wallet), meatMint: mm.meat, userMeat: ata(mm.meat, wallet), tokenProgram: TOKEN_PROGRAM_ID,
  });
  expectWiring(program, await refund("forge"), "forgeAttemptExpire", {
    config, materialMints, forgeCommit: k(4), user: wallet, vrfSlot: slot(program, k(74)), auth,
    woodMint: cfg.woodMint, userWood: ata(cfg.woodMint, wallet), stoneMint: cfg.stoneMint, userStone: ata(cfg.stoneMint, wallet), tokenProgram: TOKEN_PROGRAM_ID,
  });
  expectWiring(program, await refund("lottery"), "expireLotteryDraw", { config, lotteryRound: k(5), vrfSlot: slot(program, k(75)) });
  expectWiring(questsProgram, await refund("drum"), "drumExpire", {
    drumCommit: k(6), questConfig: pda.questConfigPda()[0], cranker, user: wallet, treasuryMascot: qc.treasuryMascot, mascotMint: qc.mascotMint,
    userMascot: ata(qc.mascotMint, wallet), vrfSlot: slot(questsProgram, k(76)), tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SYSTEM,
  });

  // ---- player self-settlement: ownership, phase split, who pays
  {
    currentSlot = 1_001 + vrfModule.VRF_REFUND_AFTER_SLOTS - 1;
    const revealable = await settlement.selfSettleTransaction("pack", k(1), wallet);
    assert.deepEqual(revealable, { tx: "base64-tx", phase: "revealable" });
    assert.deepEqual(coSigned, { count: vrfModule.vrfComputeBudget().length + 1, payer: wallet.toBase58(), lastDisc: disc(program, "packOpenReveal") });

    currentSlot = 1_001 + vrfModule.VRF_REFUND_AFTER_SLOTS;
    const refundable = await settlement.selfSettleTransaction("pack", k(1), wallet);
    assert.equal(refundable.phase, "refundable");
    assert.equal(coSigned!.lastDisc, disc(program, "packOpenExpire"), "after the window the player gets the refund path, never the reveal");
    assert.equal(coSigned!.payer, wallet.toBase58(), "the player is the fee payer; the backend signs nothing");

    await assert.rejects(settlement.selfSettleTransaction("pack", k(1), k(41)), (e: any) => e.status === 403 && /another wallet/.test(e.message));
    await assert.rejects(settlement.selfSettleTransaction("pack", k(99), wallet), (e: any) => e.status === 409 && e.message === "COMMIT_ALREADY_SETTLED");
    // A lottery draw has no owner: any player may settle it.
    currentSlot = 5_001;
    assert.equal((await settlement.selfSettleTransaction("lottery", k(5), k(42))).phase, "revealable");
    assert.equal(coSigned!.lastDisc, disc(program, "drawLottery"));
  }

  // ---- status from chain state only
  {
    currentSlot = 1_001 + 100;
    assert.deepEqual(await settlement.commitStatus("pack", k(1)), {
      state: "pending", phase: "revealable", commitSlot: 1_001, currentSlot: 1_101, refundAfterSlot: 1_001 + vrfModule.VRF_REFUND_AFTER_SLOTS,
    });
    currentSlot = 1_001 + vrfModule.VRF_REFUND_AFTER_SLOTS;
    assert.equal((await settlement.commitStatus("pack", k(1)) as any).phase, "refundable");

    live.packCommit = [];
    assert.deepEqual(await settlement.commitStatus("pack", k(1)), { state: "refunded" }, "commit closed and no tool minted = refunded");
    const mint = pda.packMintPda(k(1))[0];
    live.toolData = [{ publicKey: pda.toolPda(mint)[0], account: { toolType: "pickaxe", rarity: { rare: {} }, durability: bn(88) } }];
    assert.deepEqual(await settlement.commitStatus("pack", k(1)), { state: "settled", mint: mint.toBase58(), tool: { toolType: "pickaxe", rarity: "rare", durability: 88 } });
    live.toolData[0].account.rarity = 4;
    assert.equal((await settlement.commitStatus("pack", k(1)) as any).tool.rarity, "legendary", "numeric rarity maps through the same table");
    live.toolData[0].account.rarity = { mythic: {} };
    assert.equal((await settlement.commitStatus("pack", k(1)) as any).tool.rarity, "unknown");

    live.rerollCommit = [];
    assert.deepEqual(await settlement.commitStatus("reroll", k(2)), { state: "refunded" });
    live.forgeCommit = [];
    assert.deepEqual(await settlement.commitStatus("forge", k(4)), { state: "unknown" }, "forge mints nothing to look up");
    reset();
  }

  // ---- small pure helpers
  {
    assert.ok(settlement.settlementMint("pack", k(1))!.equals(pda.packMintPda(k(1))[0]));
    assert.ok(settlement.settlementMint("reroll", k(2))!.equals(pda.rerollMintPda(k(2))[0]));
    for (const m of ["exploration", "forge", "lottery", "drum"] as Mechanic[]) assert.equal(settlement.settlementMint(m, k(3)), null);
    assert.ok(settlement.drumCommitAddress(wallet).equals(pda.drumCommitPda(wallet)[0]));
    assert.equal(settlement.toBn("18446744073709551615").toString(), "18446744073709551615");
    assert.equal(settlement.toBn(7n).toNumber(), 7);
    assert.deepEqual(settlement.MECHANICS, ["pack", "reroll", "exploration", "forge", "lottery", "drum"]);
  }

  console.log("vrf settlement self-test: discovery per mechanic, lottery filter, reveal + refund wiring vs IDL (6 mechanics), self-settlement ownership/phase, status passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
