import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction, MessageV0, ComputeBudgetProgram } from "@solana/web3.js";
import { createApproveInstruction, createSetAuthorityInstruction, AuthorityType, createInitializeMintInstruction, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { guardTransaction, getAofGuardConfig } from "../src/lib/txGuard";
import { confirmSignature } from "../src/lib/confirmation";
const user = Keypair.generate();
const other = Keypair.generate().publicKey;
const core = new PublicKey("HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq");
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
test("user-funded prep-mint permits only canonical zero-decimal, non-freezable mints", async () => {
  const mint = Keypair.generate();
  const auth = PublicKey.findProgramAddressSync([Buffer.from("auth")], core)[0];
  const tx = transaction(
    SystemProgram.createAccount({ fromPubkey: user.publicKey, newAccountPubkey: mint.publicKey, lamports: 1_461_600, space: 82, programId: TOKEN_PROGRAM_ID }),
    createInitializeMintInstruction(mint.publicKey, 0, auth, null),
    createAssociatedTokenAccountIdempotentInstruction(user.publicKey, getAssociatedTokenAddressSync(mint.publicKey, user.publicKey), user.publicKey, mint.publicKey),
  );
  tx.partialSign(mint);
  const bytes = tx.serialize({ requireAllSignatures: false });
  assert.equal((await guard(tx)).safe, true);
  assert.deepEqual(tx.serialize({ requireAllSignatures: false }), bytes);
  tx.instructions[1] = createInitializeMintInstruction(mint.publicKey, 0, other, other);
  assert.equal((await guard(tx)).safe, false);
});
test("lookup table messages are rejected rather than partially inspected", async () => {
  const legacy = transaction(new TransactionInstruction({ programId: core, keys: [], data: Buffer.alloc(8) }));
  const message = legacy.compileMessage();
  const tx = new VersionedTransaction(new MessageV0({
    header: message.header, staticAccountKeys: message.accountKeys,
    recentBlockhash: message.recentBlockhash, compiledInstructions: [],
    addressTableLookups: [{ accountKey: other, writableIndexes: [0], readonlyIndexes: [] }],
  }));
  assert.equal((await guard(tx)).safe, false);
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

  // Authority-only instructions must never reach a player wallet.
  for (const name of ["pay_out", "mint_tool", "set_paused", "set_supply_cap"]) {
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
