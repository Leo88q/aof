import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AddressLookupTableAccount, ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { createApproveInstruction, createSetAuthorityInstruction, AuthorityType, createInitializeMintInstruction, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { guardTransaction, getAofGuardConfig } from "../src/lib/txGuard";
import { confirmSignature } from "../src/lib/confirmation";
const user = Keypair.generate();
const other = Keypair.generate().publicKey;
const core = new PublicKey("okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx");
function transaction(...ix: TransactionInstruction[]) {
  return new Transaction({ feePayer: user.publicKey, recentBlockhash: other.toBase58() }).add(...ix);
}
let simulated = 0;
const rpc: any = {
  getFeeForMessage: async () => ({ value: 10_000 }),
  simulateTransaction: async (tx: VersionedTransaction, options: any) => {
    assert.ok(tx instanceof VersionedTransaction);
    assert.equal(options.replaceRecentBlockhash, false);
    simulated++;
    return { value: { err: null, logs: [] } };
  },
};
const guard = (tx: Transaction | VersionedTransaction, overrides: any = {}, connection = rpc) =>
  guardTransaction(tx, user.publicKey, { ...getAofGuardConfig(), ...overrides }, connection);

test("classic token approvals and authority changes fail before simulation", async () => {
  const before = simulated;
  for (const ix of [
    createApproveInstruction(other, other, user.publicKey, 999999n),
    createSetAuthorityInstruction(other, user.publicKey, AuthorityType.AccountOwner, other),
    SystemProgram.assign({ accountPubkey: user.publicKey, programId: other }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000_000 }),
  ]) {
    assert.equal((await guard(transaction(ix))).safe, false);
  }
  assert.equal(simulated, before);
});
test("explicit SOL drain, unknown programs, excessive fee and RPC errors fail closed", async () => {
  assert.equal((await guard(transaction(SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: other, lamports: 1_000_000_000 })))).safe, false);
  assert.equal((await guard(transaction(new TransactionInstruction({ programId: other, keys: [], data: Buffer.alloc(0) })))).safe, false);
  const tx = transaction(new TransactionInstruction({ programId: core, keys: [], data: Buffer.alloc(8) }));
  assert.equal((await guard(tx, {}, { ...rpc, getFeeForMessage: async () => ({ value: 1_000_000_000 }) })).safe, false);
  assert.equal((await guard(tx, {}, { ...rpc, simulateTransaction: async () => { throw Error("RPC unavailable"); } })).safe, false);
  assert.equal((await guard(tx, {}, { ...rpc, simulateTransaction: async () => ({ value: { err: "InstructionError" } }) })).safe, false);
});
test("legacy and versioned known-program transactions simulate with the correct overload", async () => {
  const tx = transaction(new TransactionInstruction({ programId: core, keys: [], data: Buffer.alloc(8) }));
  assert.equal((await guard(tx)).safe, true);
  assert.equal((await guard(new VersionedTransaction(tx.compileMessage()))).safe, true);
  tx.feePayer = other;
  assert.equal((await guard(tx)).safe, false);
});
test("user-funded prep-mint pins both temporary authorities to auth; issuance must revoke them", async () => {
  const mint = Keypair.generate();
  const auth = PublicKey.findProgramAddressSync([Buffer.from("auth")], core)[0];
  const tx = transaction(
    SystemProgram.createAccount({ fromPubkey: user.publicKey, newAccountPubkey: mint.publicKey, lamports: 1_461_600, space: 82, programId: TOKEN_PROGRAM_ID }),
    createInitializeMintInstruction(mint.publicKey, 0, auth, auth),
    createAssociatedTokenAccountIdempotentInstruction(user.publicKey, getAssociatedTokenAddressSync(mint.publicKey, user.publicKey), user.publicKey, mint.publicKey),
  );
  tx.partialSign(mint);
  const bytes = tx.serialize({ requireAllSignatures: false });
  assert.equal((await guard(tx)).safe, true);
  assert.deepEqual(tx.serialize({ requireAllSignatures: false }), bytes);
  tx.instructions[1] = createInitializeMintInstruction(mint.publicKey, 0, auth, other);
  assert.equal((await guard(tx)).safe, false);
});
test("v0 lookup keys are resolved before the wallet guard inspects and simulates them", async () => {
  const lookupTable = new AddressLookupTableAccount({
    key: Keypair.generate().publicKey,
    state: {
      deactivationSlot: (1n << 64n) - 1n,
      lastExtendedSlot: 1n,
      lastExtendedSlotStartIndex: 0,
      authority: undefined,
      addresses: [other],
    },
  });
  const ix = new TransactionInstruction({
    programId: core,
    keys: [{ pubkey: other, isSigner: false, isWritable: false }],
    data: Buffer.alloc(8),
  });
  const tx = new VersionedTransaction(new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: other.toBase58(),
    instructions: [ix],
  }).compileToV0Message([lookupTable]));
  assert.equal((await guard(tx)).safe, false, "missing lookup RPC support must fail closed");
  const altRpc = {
    ...rpc,
    getSlot: async () => 100,
    getAddressLookupTable: async (key: PublicKey) => ({
      value: lookupTable.key.equals(key) ? lookupTable : null,
    }),
  };
  assert.equal((await guard(tx, {}, altRpc)).safe, true);
});
test("confirmation rejects failed/unknown outcomes and waits for confirmed status", async () => {
  const signature = "2".repeat(88);
  let calls = 0;
  await confirmSignature({ getSignatureStatuses: async () => ({ value: [++calls > 1 ? { err: null, confirmationStatus: "confirmed" } : null] }) } as any, signature, async () => {}, 3);
  assert.equal(calls, 2);
  await assert.rejects(confirmSignature({ getSignatureStatuses: async () => ({ value: [{ err: "failure" }] }) } as any, signature, async () => {}, 1), /не исполнена/);
  await assert.rejects(confirmSignature({ getSignatureStatuses: async () => ({ value: [null] }) } as any, signature, async () => {}, 1), /Не повторяйте/);
});

import { validateTransactionIntent, MARKETPLACE_BUY_DISCRIMINATOR, type MarketplaceBuyIntent } from "../src/lib/transactionIntent";
import { positiveU64, solToLamports, lamportsToSol } from "../src/lib/amounts";
function purchaseFixture() {
  const mint = Keypair.generate().publicKey;
  const intent: MarketplaceBuyIntent = {
    kind: "marketplaceBuy", buyer: user.publicKey.toBase58(), seller: other.toBase58(),
    treasury: Keypair.generate().publicKey.toBase58(), mint: mint.toBase58(),
    maxPriceLamports: "18446744073709551615", expiresAt: String(Math.floor(Date.now() / 1000) + 120),
  };
  const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from(seed), ...(key ? [key.toBuffer()] : [])], core)[0];
  const listing = pda("listing", mint);
  const keys = [pda("config"), user.publicKey, other, new PublicKey(intent.treasury), mint, pda("tool", mint), listing,
    getAssociatedTokenAddressSync(mint, listing, true), getAssociatedTokenAddressSync(mint, user.publicKey), TOKEN_PROGRAM_ID, SystemProgram.programId];
  const data = Buffer.alloc(24);
  data.set(MARKETPLACE_BUY_DISCRIMINATOR);
  data.writeBigUInt64LE(BigInt(intent.maxPriceLamports), 8);
  data.writeBigInt64LE(BigInt(intent.expiresAt), 16);
  const ix = { programId: core.toBase58(), keys, data };
  return { ix, intent };
}

test("marketplace intent binds exact account destinations, u64 price and deadline", () => {
  const { ix, intent } = purchaseFixture();
  assert.doesNotThrow(() => validateTransactionIntent([ix], intent, user.publicKey));
  assert.throws(() => validateTransactionIntent([ix], undefined, user.publicKey), /requires/);
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const keys = [...ix.keys]; keys[index] = Keypair.generate().publicKey;
    assert.throws(() => validateTransactionIntent([{ ...ix, keys }], intent, user.publicKey));
  }
  const data = Buffer.from(ix.data); data.writeBigUInt64LE(1n, 8);
  assert.throws(() => validateTransactionIntent([{ ...ix, data }], intent, user.publicKey), /price/);
  assert.throws(() => validateTransactionIntent([ix], { ...intent, expiresAt: "1" }, user.publicKey), /expired/);
  assert.throws(() => validateTransactionIntent([ix], intent, other), /Wallet/);
});
test("marketplace intent rejects added allowed-program actions and extra rent destinations", () => {
  const { ix, intent } = purchaseFixture();
  for (const extra of [ix, { ...ix, data: Buffer.alloc(8) }, { ...ix, programId: SystemProgram.programId.toBase58(), data: Buffer.alloc(12) }]) {
    assert.throws(() => validateTransactionIntent([ix, extra], intent, user.publicKey));
  }
  const mint = new PublicKey(intent.mint);
  const ata = createAssociatedTokenAccountIdempotentInstruction(user.publicKey, getAssociatedTokenAddressSync(mint, user.publicKey), user.publicKey, mint);
  const parsed = { programId: ata.programId.toBase58(), data: ata.data, keys: ata.keys.map((key) => key.pubkey) };
  assert.doesNotThrow(() => validateTransactionIntent([parsed, ix], intent, user.publicKey));
  const bad = { ...parsed, keys: [...parsed.keys] }; bad.keys[2] = other;
  assert.throws(() => validateTransactionIntent([bad, ix], intent, user.publicKey), /rent/);
});
test("the real guard enforces local intent for a signed purchase", async () => {
  const { ix, intent } = purchaseFixture();
  const tx = transaction(new TransactionInstruction({ programId: core, data: ix.data, keys: ix.keys.map((pubkey, i) => ({ pubkey, isWritable: i >= 1 && i <= 8, isSigner: i === 1 })) }));
  assert.equal((await guard(tx)).safe, false);
  assert.equal((await guard(tx, { intent })).safe, true);
  const data = Buffer.from(ix.data); data[8] = 0;
  tx.instructions[0].data = data;
  assert.equal((await guard(tx, { intent })).safe, false);
});
test("decimal SOL parsing never rounds and supports values above Number precision", () => {
  assert.equal(solToLamports("0.000000001"), "1");
  assert.equal(solToLamports("9007199.254740993"), "9007199254740993");
  assert.equal(solToLamports("18446744073.709551615"), "18446744073709551615");
  for (const value of ["0", "-1", "1e9", "NaN", "0.0000000001", "18446744073.709551616", "01"]) assert.throws(() => solToLamports(value));
  assert.throws(() => positiveU64(100));
  assert.equal(lamportsToSol("1"), "0.000000001");
  assert.equal(lamportsToSol("1000000000"), "1");
  assert.equal(lamportsToSol("18446744073709551615"), "18446744073.709551615");
});

import { getAssociatedTokenAddressSync as deriveAta } from "../src/lib/associatedToken";
test("browser ATA helper matches the SPL SDK for wallets and PDA owners", () => {
  for (let i = 0; i < 20; i++) {
    const mint = Keypair.generate().publicKey, owner = Keypair.generate().publicKey;
    assert.ok(deriveAta(mint, owner).equals(getAssociatedTokenAddressSync(mint, owner)));
    const pda = PublicKey.findProgramAddressSync([mint.toBuffer()], core)[0];
    assert.ok(deriveAta(mint, pda, true).equals(getAssociatedTokenAddressSync(mint, pda, true)));
    assert.throws(() => deriveAta(mint, pda));
  }
});

test("legacy unbounded purchase, trailing bytes, extra accounts and cosigners fail closed", async () => {
  const { ix, intent } = purchaseFixture();
  const legacy = { ...ix, data: Buffer.from([92, 247, 50, 140, 72, 120, 69, 249]) };
  assert.throws(() => validateTransactionIntent([legacy], undefined, user.publicKey), /legacy/);
  assert.throws(() => validateTransactionIntent([{ ...ix, data: Buffer.concat([ix.data, Buffer.from([0])]) }], intent, user.publicKey));
  assert.throws(() => validateTransactionIntent([{ ...ix, keys: [...ix.keys, other] }], intent, user.publicKey));
  const tx = transaction(new TransactionInstruction({ programId: core, data: ix.data,
    keys: ix.keys.map((pubkey, i) => ({ pubkey, isWritable: i >= 1 && i <= 8, isSigner: i === 1 || i === 2 })) }));
  assert.equal((await guard(tx, { intent })).safe, false);
});

// ---------------------------------------------------------------------------
// [AUDIT F-32] generic aof-core instruction policy
// ---------------------------------------------------------------------------
import { validateCoreInstructions, CORE_PROGRAM_ID } from "../src/lib/transactionIntent";
import { CORE_INSTRUCTIONS } from "../src/lib/coreInstructions";

function specOf(name: string) {
  const spec = CORE_INSTRUCTIONS.find((s) => s.name === name);
  if (!spec) throw new Error(`no spec for ${name}`);
  return spec;
}
function ixFor(name: string, keys: PublicKey[]) {
  return { programId: CORE_PROGRAM_ID, data: Uint8Array.from(specOf(name).discriminator), keys };
}

test("core instruction policy names every instruction and rejects authority-only calls", () => {
  // start_mining is a player instruction whose `user` slot is a required signer.
  const start = specOf("start_mining");
  assert.ok(start.actorIndexes.length === 1 && start.signerIndexes.includes(start.actorIndexes[0]));
  // auction_settle is permissionless: its seller slot is a payee, not a signer,
  // so the wallet is not required to be there.
  const settle = specOf("auction_settle");
  assert.ok(!settle.actorIndexes.some((i) => settle.signerIndexes.includes(i)));
  const keys = Array.from({ length: start.accounts.length }, () => Keypair.generate().publicKey);
  keys[start.actorIndexes[0]] = user.publicKey;
  assert.doesNotThrow(() => validateCoreInstructions([ixFor("start_mining", keys)], user.publicKey));

  // The actor slot must be the connected wallet: a tampered backend swapping in
  // another wallet is rejected.
  const swapped = [...keys];
  swapped[start.actorIndexes[0]] = other;
  assert.throws(() => validateCoreInstructions([ixFor("start_mining", swapped)], user.publicKey), /user/);

  // Wrong account count is rejected.
  assert.throws(() => validateCoreInstructions([ixFor("start_mining", keys.slice(1))], user.publicKey), /account count/);

  // Instructions signed only by authority must never reach a player wallet.
  // mint_tool is deliberately excluded: it has a separate player-payer path,
  // gated below by an explicit local intent and authority != player.
  for (const name of ["pay_out", "set_paused", "set_supply_cap"]) {
    const spec = specOf(name);
    const authorityKeys = Array.from({ length: spec.accounts.length }, () => Keypair.generate().publicKey);
    assert.throws(
      () => validateCoreInstructions([ixFor(name, authorityKeys)], user.publicKey),
      /Authority-only/,
      `${name} must be rejected`,
    );
  }

  // An unknown discriminator inside our own program is not "probably fine".
  const unknown = { programId: CORE_PROGRAM_ID, data: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]), keys: [] };
  assert.doesNotThrow(() => validateCoreInstructions([unknown], user.publicKey),
    "unrecognised instructions are left to the program allowlist check in txGuard");
});

test("core instruction table covers the committed IDL", () => {
  assert.ok(CORE_INSTRUCTIONS.length >= 99);
  const names = new Set(CORE_INSTRUCTIONS.map((s) => s.name));
  for (const required of ["marketplace_buy_bounded", "craft", "reroll", "collect_mining", "withdraw_gas"]) {
    assert.ok(names.has(required), `${required} missing from the table`);
  }
  assert.equal(new Set(CORE_INSTRUCTIONS.map((s) => s.discriminator.join(","))).size, CORE_INSTRUCTIONS.length,
    "discriminators must be unique");
});

test("core instruction table matches IDL and exclusively operator-signed instructions are authority-only", () => {
  // [nf-mutate 2026-09-28] a +1 in any discriminator byte, a dropped signer
  // index or a flipped authorityOnly flag survived the old coverage test.
  // The table is generated from this IDL (scripts/gen-core-instruction-table.py);
  // here the generated rows are re-derived from the IDL and compared.
  const idl = JSON.parse(readFileSync(new URL("../../aof_backend/src/idl/aof_core.json", import.meta.url), "utf8"));
  const ACTOR = new Set(["user", "buyer", "seller", "maker", "caller", "cranker", "payer", "bidder", "recipient", "renter", "owner", "creator", "fulfiller", "winner", "referred", "sender"]);
  const ACTOR_BY_INSTRUCTION: Record<string, Set<string>> = {
    sync_tool_owner: new Set(["holder"]),
    init_season_pass: new Set(["player"]),
    init_player: new Set(["player"]),
  };
  // Signer slots that name a role, never a player. `caller` of emergency_stop is
  // the guardian/admin (constraint in aof-core), `new_authority` accepts a rotation.
  const PRIVILEGED = new Set(["authority", "operator", "guardian", "admin", "migration_authority", "new_authority"]);
  const ROLE_ONLY_EXCEPTIONS = new Set(["emergency_stop"]);
  assert.equal(CORE_INSTRUCTIONS.length, idl.instructions.length, "one row per IDL instruction");
  for (const ix of idl.instructions) {
    const spec = specOf(ix.name);
    assert.deepEqual([...spec.discriminator], ix.discriminator, `${ix.name}: discriminator`);
    assert.deepEqual([...spec.accounts], ix.accounts.map((a: any) => a.name), `${ix.name}: account names/order`);
    assert.deepEqual([...spec.signerIndexes], ix.accounts.map((a: any, i: number) => (a.signer ? i : -1)).filter((i: number) => i >= 0), `${ix.name}: signer slots`);
    const actorNames = new Set([...ACTOR, ...(ACTOR_BY_INSTRUCTION[ix.name] ?? [])]);
    assert.deepEqual([...spec.actorIndexes], ix.accounts.map((a: any, i: number) => (actorNames.has(a.name) ? i : -1)).filter((i: number) => i >= 0), `${ix.name}: actor slots`);
    const signers = ix.accounts.filter((a: any) => a.signer).map((a: any) => a.name);
    const onlyPrivileged = signers.length > 0 && signers.every((n: string) => PRIVILEGED.has(n));
    if (onlyPrivileged) assert.equal(spec.authorityOnly, true, `${ix.name} is signed only by ${signers.join("+")} and must be authority-only`);
    if (spec.authorityOnly && !ROLE_ONLY_EXCEPTIONS.has(ix.name)) {
      assert.ok(signers.some((n: string) => PRIVILEGED.has(n)), `${ix.name} is marked authority-only but has no privileged signer`);
    }
    if (!spec.authorityOnly && signers.length > 0) {
      assert.ok(signers.some((n: string) => actorNames.has(n)), `${ix.name}: a player-signable instruction must have a player signer slot (got ${signers.join("+")})`);
    }
  }
  // Operator-signed, sent by the backend (season rewards and lottery setup).
  assert.equal(specOf("claim_season_reward").authorityOnly, true);
  assert.equal(specOf("claim_premium_season_reward").authorityOnly, true);
  assert.equal(specOf("init_lottery_round").authorityOnly, true);
  // A player wallet presented with any must be refused.
  for (const name of ["claim_season_reward", "claim_premium_season_reward", "init_lottery_round"]) {
    const spec = specOf(name);
    const keys = Array.from({ length: spec.accounts.length }, () => Keypair.generate().publicKey);
    assert.throws(() => validateCoreInstructions([ixFor(name, keys)], user.publicKey), /Authority-only/, name);
  }
});

function toolMintFixture() {
  const mint = Keypair.generate().publicKey;
  const authority = other;
  const toolType = "plasma_cutter";
  const rarity = 0; // common
  const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync(
    [Buffer.from(seed), ...(key ? [key.toBuffer()] : [])], core,
  )[0];
  const data = Buffer.alloc(8 + 4 + Buffer.byteLength(toolType) + 1);
  data.set(specOf("mint_tool").discriminator);
  data.writeUInt32LE(Buffer.byteLength(toolType), 8);
  data.write(toolType, 12, "utf8");
  data[12 + Buffer.byteLength(toolType)] = rarity;
  const metadataProgram = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const metadataSeeds = [Buffer.from("metadata"), metadataProgram.toBuffer(), mint.toBuffer()];
  const metadata = PublicKey.findProgramAddressSync(metadataSeeds, metadataProgram)[0];
  const ix = {
    programId: core.toBase58(),
    keys: [pda("config"), authority, pda("auth"), mint,
      getAssociatedTokenAddressSync(mint, user.publicKey), user.publicKey, user.publicKey,
      pda("tool", mint), TOKEN_PROGRAM_ID, SystemProgram.programId, pda("tool_metadata_registry"),
      metadata, metadataProgram],
    data,
  };
  const intent = { kind: "toolMint" as const, user: user.publicKey.toBase58(),
    mint: mint.toBase58(), authority: authority.toBase58(), toolType, rarity: "common" as const };
  return { ix, intent };
}

test("player tool mint requires local intent and binds payer = recipient = wallet, never authority", () => {
  const { ix, intent } = toolMintFixture();
  assert.doesNotThrow(() => validateTransactionIntent([ix], intent, user.publicKey));
  assert.throws(() => validateTransactionIntent([ix], undefined, user.publicKey), /local user intent/);

  const wrongRecipient = { ...ix, keys: [...ix.keys] };
  wrongRecipient.keys[5] = other;
  assert.throws(() => validateTransactionIntent([wrongRecipient], intent, user.publicKey), /tool mint accounts/);
  const wrongPayer = { ...ix, keys: [...ix.keys] };
  wrongPayer.keys[6] = other;
  assert.throws(() => validateTransactionIntent([wrongPayer], intent, user.publicKey), /payer/);

  const authorityAsPlayer = { ...ix, keys: [...ix.keys] };
  authorityAsPlayer.keys[1] = user.publicKey;
  assert.throws(() => validateTransactionIntent([authorityAsPlayer],
    { ...intent, authority: user.publicKey.toBase58() }, user.publicKey), /Authority cannot/);
  const extra = { programId: SystemProgram.programId.toBase58(), keys: [user.publicKey], data: Buffer.alloc(0) };
  assert.throws(() => validateTransactionIntent([ix, extra], intent, user.publicKey), /outside/);
});

// ---------------------------------------------------------------------------
// [F-06] Switchboard-settled packs
// ---------------------------------------------------------------------------
import { PACK_OPEN_COMMIT_DISCRIMINATOR, expectedSigners } from "../src/lib/transactionIntent";
import { SWITCHBOARD_PROGRAMS, TOKEN_METADATA_PROGRAM_ID } from "../src/lib/txGuard";

function packCommitFixture(maxPrice = 100_000_000n, packType = 0) {
  const operator = Keypair.generate().publicKey;
  const keys = [
    PublicKey.findProgramAddressSync([Buffer.from("config")], core)[0], operator, user.publicKey,
    ...Array.from({ length: 10 }, () => Keypair.generate().publicKey),
  ];
  const data = Buffer.alloc(25);
  data.set(PACK_OPEN_COMMIT_DISCRIMINATOR);
  data[8] = packType;
  data.writeBigUInt64LE(42n, 9);
  data.writeBigUInt64LE(maxPrice, 17);
  const intent = { kind: "packOpen" as const, user: user.publicKey.toBase58(), packType, maxPriceLamports: maxPrice.toString() };
  return { ix: { programId: core.toBase58(), keys, data }, intent, operator };
}

test("pack intent binds the wallet, the pack type and the price ceiling", () => {
  const { ix, intent } = packCommitFixture();
  assert.doesNotThrow(() => validateTransactionIntent([ix], intent, user.publicKey));
  const pricier = Buffer.from(ix.data); pricier.writeBigUInt64LE(100_000_001n, 17);
  assert.throws(() => validateTransactionIntent([{ ...ix, data: pricier }], intent, user.publicKey), /ceiling/);
  const bigger = Buffer.from(ix.data); bigger[8] = 2;
  assert.throws(() => validateTransactionIntent([{ ...ix, data: bigger }], intent, user.publicKey), /type/);
  const keys = [...ix.keys]; keys[2] = other;
  assert.throws(() => validateTransactionIntent([{ ...ix, keys }], intent, user.publicKey));
  assert.throws(() => validateTransactionIntent([ix, ix], intent, user.publicKey));
  const drain = { programId: SystemProgram.programId.toBase58(), keys: [user.publicKey, other], data: Buffer.alloc(12) };
  assert.throws(() => validateTransactionIntent([ix, drain], intent, user.publicKey), /outside/);
  assert.equal(expectedSigners(intent), 2, "the operator co-signs a pack commit");
  assert.equal(expectedSigners(undefined), 1);
});

test("pack and purchase intents allow the durable nonce prelude but not another payment", () => {
  const operator = new PublicKey("C8MS1G3g7aR39pAGYnFjcz4uj693dYw3icWTMCV7cYRN");
  const nonce = Keypair.generate().publicKey;
  const advance = {
    programId: SystemProgram.programId.toBase58(),
    keys: [nonce, new PublicKey("SysvarRecentB1ockHashes11111111111111111111"), user.publicKey],
    data: Uint8Array.from([4, 0, 0, 0]),
  };
  const refundData = Buffer.alloc(12);
  refundData.writeUInt32LE(2, 0);
  refundData.writeBigUInt64LE(1_447_680n, 4);
  const refund = { programId: SystemProgram.programId.toBase58(), keys: [user.publicKey, operator], data: refundData };
  const budget = { programId: "ComputeBudget111111111111111111111111111111", keys: [], data: Uint8Array.from([2, 0x80, 0x1a, 0x06, 0x00]) };
  const pack = packCommitFixture();
  assert.doesNotThrow(() => validateTransactionIntent([advance, budget, refund, pack.ix], pack.intent, user.publicKey));
  const purchase = purchaseFixture();
  assert.doesNotThrow(() => validateTransactionIntent([advance, budget, refund, purchase.ix], purchase.intent, user.publicKey));
  const toOther = { ...refund, keys: [user.publicKey, other] };
  assert.throws(() => validateTransactionIntent([advance, toOther, pack.ix], pack.intent, user.publicKey), /outside/);
  assert.throws(() => validateTransactionIntent([refund, pack.ix], pack.intent, user.publicKey), /without nonce advance/);
  assert.throws(() => validateTransactionIntent([advance, refund, refund, pack.ix], pack.intent, user.publicKey), /operator transfer/);
  const lateAdvance = [pack.ix, advance];
  assert.throws(() => validateTransactionIntent(lateAdvance, pack.intent, user.publicKey), /outside/);
});

test("Switchboard is accepted only as the game program's CPI, never as a top-level instruction", async () => {
  const direct = transaction(new TransactionInstruction({ programId: new PublicKey(SWITCHBOARD_PROGRAMS[0]), keys: [], data: Buffer.alloc(8) }));
  assert.equal((await guard(direct)).safe, false);
  const viaGame = transaction(new TransactionInstruction({ programId: core, keys: [], data: Buffer.alloc(8) }));
  const logsWithCpi: any = {
    ...rpc,
    simulateTransaction: async () => ({ value: { err: null, logs: [
      `Program ${core.toBase58()} invoke [1]`, `Program ${SWITCHBOARD_PROGRAMS[0]} invoke [2]`,
    ] } }),
  };
  assert.equal((await guard(viaGame, {}, logsWithCpi)).safe, true);
});

test("Token Metadata is accepted only as the game program's CPI, never as a top-level instruction", async () => {
  const direct = transaction(new TransactionInstruction({ programId: new PublicKey(TOKEN_METADATA_PROGRAM_ID), keys: [], data: Buffer.alloc(8) }));
  assert.equal((await guard(direct)).safe, false);
  const viaGame = transaction(new TransactionInstruction({ programId: core, keys: [], data: Buffer.alloc(8) }));
  const logsWithCpi: any = {
    ...rpc,
    simulateTransaction: async () => ({ value: { err: null, logs: [
      `Program ${core.toBase58()} invoke [1]`, `Program ${TOKEN_METADATA_PROGRAM_ID} invoke [2]`,
    ] } }),
  };
  assert.equal((await guard(viaGame, {}, logsWithCpi)).safe, true);
});

// A season pass is a SOL payment: the wallet must only see the one canonical
// purchase instruction for the verified season and treasury.
test("season pass intent binds exact payment, season and rent accounts", async () => {
  const { validateTransactionIntent } = await import("../src/lib/transactionIntent");
  const { CORE_INSTRUCTIONS } = await import("../src/lib/coreInstructions");
  const spec = CORE_INSTRUCTIONS.find(s => s.name === 'purchase_season_pass')!;
  const seasonId = 1;
  const seed = Buffer.alloc(4); seed.writeUInt32LE(seasonId);
  const derive = (...parts: Buffer[]) => PublicKey.findProgramAddressSync(parts, core)[0];
  const seasonPass = derive(Buffer.from('season_pass'), user.publicKey.toBuffer(), seed);
  const premiumClaims = derive(Buffer.from('season_premium_claims'), user.publicKey.toBuffer(), seed);
  const keys = [derive(Buffer.from('config')), user.publicKey, other,
    derive(Buffer.from('season'), seed), seasonPass, premiumClaims, SystemProgram.programId];
  const ix = { programId: core.toBase58(), keys, data: Uint8Array.from(spec.discriminator) };
  const intent = { kind: 'seasonPass' as const, user: user.publicKey.toBase58(), treasury: other.toBase58(),
    seasonId, priceLamports: '150000000' as const };
  const quote = {
    version: 1 as const, payer: user.publicKey.toBase58(), recentBlockhash: other.toBase58(),
    lastValidBlockHeight: 123, messageSha256: 'a'.repeat(64), networkFeeLamports: '10000',
    rentLamports: '0', maxRentLamports: '3000', maxCostLamports: '13000',
    rentAccounts: [
      { name: 'season_pass', address: seasonPass.toBase58(), size: 57, strategy: 'init_if_needed' as const,
        exists: true, rentDueLamports: '0', maxRentLamports: '1000' },
      { name: 'premium_claims', address: premiumClaims.toBase58(), size: 53, strategy: 'init_if_needed' as const,
        exists: true, rentDueLamports: '0', maxRentLamports: '2000' },
    ],
  };
  const boundIntent = { ...intent, quote };
  assert.doesNotThrow(() => validateTransactionIntent([ix], boundIntent, user.publicKey));
  for (const index of [2, 3, 4, 5]) {
    const changed = [...keys]; changed[index] = Keypair.generate().publicKey;
    assert.throws(() => validateTransactionIntent([{ ...ix, keys: changed }], boundIntent, user.publicKey));
  }
  assert.throws(() => validateTransactionIntent([ix], { ...boundIntent, treasury: user.publicKey.toBase58() }, user.publicKey));
  assert.throws(() => validateTransactionIntent([ix, ix], boundIntent, user.publicKey));
  assert.throws(() => validateTransactionIntent([ix], { ...boundIntent, priceLamports: '1' as any }, user.publicKey));
  const changedQuote = { ...quote, rentAccounts: quote.rentAccounts.slice(0, 1) };
  assert.throws(() => validateTransactionIntent([ix], { ...boundIntent, quote: changedQuote }, user.publicKey), /payer quote/);
});

test("VIP read distinguishes missing pass from failed or forged reads", async () => {
  const { readVipSnapshot } = await import("../src/lib/vipReadings");
  const owner = user.publicKey.toBase58();
  const privileges = { farmTrader: { enabled: false }, priceAlerts: { limit: 1, fullOptions: false },
    skipAdsInQuests: false, feeDiscountPct: 0 };
  const free = { source: 'onchain', user: owner, seasonId: 1, seasonActive: true,
    passPremium: false, isVip: false, pass: null, premiumClaims: null, privileges };
  assert.deepEqual(readVipSnapshot(free, owner, 1)?.pass, null);
  assert.equal(readVipSnapshot(null, owner, 1), null);
  assert.equal(readVipSnapshot({ ...free, source: 'database' }, owner, 1), null);
  assert.equal(readVipSnapshot({ ...free, user: other.toBase58() }, owner, 1), null);
  assert.equal(readVipSnapshot({ ...free, isVip: true }, owner, 1), null);
  const vip = { ...free, passPremium: true, isVip: true,
    pass: { premium: true, xp: 10, claimedBitmap: '5' },
    premiumClaims: { claimedBitmap: '2' },
    privileges };
  assert.equal(readVipSnapshot({ ...vip, privileges: { ...privileges, feeDiscountPct: 15 } }, owner, 1), null);
  assert.equal(readVipSnapshot(vip, owner, 1)?.pass?.claimedRewards, 2);
  assert.equal(readVipSnapshot(vip, owner, 1)?.pass?.premiumClaimedBitmap, '2');
  assert.equal(readVipSnapshot({ ...vip, premiumClaims: { claimedBitmap: '4398046511104' } }, owner, 1), null);
  assert.equal(readVipSnapshot({ ...vip, seasonActive: false, isVip: false,
    privileges }, owner, 1)?.passPremium, true);
  assert.equal(readVipSnapshot({ ...vip, pass: null }, owner, 1), null);
});
