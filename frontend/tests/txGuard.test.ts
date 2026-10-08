/**
 * Boundary and policy tests for src/lib/txGuard.ts — the last check between a
 * built transaction and the wallet's signature prompt.
 *
 * nf-mutate (2026-09-28) scored the guard at 48.9 %: fee/spend/rent ceilings
 * were only tested far from their limits, the compute-budget, ATA and mint
 * policies had no negative cases per field, and the block lists and
 * simulation-log program extraction were untested. Every test below pins one
 * of those survivors.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  AddressLookupTableAccount, ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction, createInitializeMint2Instruction, createInitializeMintInstruction, getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { GAME_OPERATOR, guardTransaction, getAofGuardConfig } from "../src/lib/txGuard";

const user = Keypair.generate();
const other = Keypair.generate().publicKey;
const core = new PublicKey("okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx");
const auth = PublicKey.findProgramAddressSync([Buffer.from("auth")], core)[0];
const coreIx = () => new TransactionInstruction({ programId: core, keys: [], data: Buffer.alloc(8) });
const transaction = (...ix: TransactionInstruction[]) =>
  new Transaction({ feePayer: user.publicKey, recentBlockhash: other.toBase58() }).add(...ix);
const rpcWith = (over: { fee?: number | null; logs?: string[]; lookupTable?: AddressLookupTableAccount | null } = {}): any => ({
  getFeeForMessage: async () => ({ value: over.fee === undefined ? 10_000 : over.fee }),
  getSlot: async () => 100,
  getAddressLookupTable: async (key: PublicKey) => ({
    value: over.lookupTable?.key.equals(key) ? over.lookupTable : null,
  }),
  simulateTransaction: async () => ({ value: { err: null, logs: over.logs || [] } }),
});
const guard = (tx: Transaction | VersionedTransaction, overrides: any = {}, rpc = rpcWith()) =>
  guardTransaction(tx, user.publicKey, { ...getAofGuardConfig(), ...overrides }, rpc);
const transfer = (lamports: number, from = user.publicKey) => SystemProgram.transfer({ fromPubkey: from, toPubkey: other, lamports });

test("network fee: exactly the ceiling passes, one lamport more, null, negative or fractional fail", async () => {
  assert.equal((await guard(transaction(coreIx()), {}, rpcWith({ fee: 150_000 }))).safe, true);
  assert.equal((await guard(transaction(coreIx()), {}, rpcWith({ fee: 150_001 }))).safe, false);
  assert.equal((await guard(transaction(coreIx()), { maxNetworkFeeLamports: 5_000 }, rpcWith({ fee: 5_000 }))).safe, true);
  assert.equal((await guard(transaction(coreIx()), { maxNetworkFeeLamports: 5_000 }, rpcWith({ fee: 5_001 }))).safe, false);
  for (const fee of [null, -1, 10.5, Number.NaN]) {
    const result = await guard(transaction(coreIx()), {}, rpcWith({ fee: fee as any }));
    assert.equal(result.safe, false, `fee ${fee}`);
    assert.match(result.reason || "", /fee/i);
  }
});

test("explicit SOL outflow: summed over the wallet's transfers, allowed up to the limit inclusive", async () => {
  const none = await guard(transaction(coreIx()));
  assert.equal(none.safe, true);
  assert.equal(none.details?.lamportsSpent, 0);
  const atLimit = await guard(transaction(transfer(300_000), transfer(200_000)));
  assert.equal(atLimit.safe, true);
  assert.equal(atLimit.details?.lamportsSpent, 500_000);
  assert.equal(atLimit.risk, "LOW");
  const over = await guard(transaction(transfer(300_000), transfer(200_001)));
  assert.equal(over.safe, false);
  assert.equal(over.risk, "HIGH");
  assert.match(over.reason || "", /Высокая стоимость/);
  // A transfer whose source is not the connected wallet is not a transfer the wallet may sign at all.
  assert.equal((await guard(transaction(transfer(1, other)))).safe, false);
  // System transfer must be exactly 12 bytes: opcode + u64. Trailing bytes are not a transfer.
  const padded = transfer(1_000);
  padded.data = Buffer.concat([padded.data, Buffer.from([0])]);
  assert.equal((await guard(transaction(padded))).safe, false);
  // A game instruction whose bytes happen to look like a transfer is never counted as SOL spend.
  const lookalike = new TransactionInstruction({
    programId: core, keys: [{ pubkey: user.publicKey, isSigner: true, isWritable: true }, { pubkey: other, isSigner: false, isWritable: true }],
    data: Buffer.from([2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]),
  });
  const notCounted = await guard(transaction(lookalike));
  assert.equal(notCounted.safe, true);
  assert.equal(notCounted.details?.lamportsSpent, 0);
});

test("compute budget: unit limit in (0, 1.4M] and price ≤ 100k microlamports, exact layouts only", async () => {
  const ok = async (ix: TransactionInstruction) => assert.equal((await guard(transaction(ix, coreIx()))).safe, true, JSON.stringify([...ix.data]));
  const bad = async (ix: TransactionInstruction) => assert.equal((await guard(transaction(ix, coreIx()))).safe, false, JSON.stringify([...ix.data]));
  await ok(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  await ok(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }));
  await ok(ComputeBudgetProgram.setComputeUnitLimit({ units: 1 }));
  await bad(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_001 }));
  await bad(ComputeBudgetProgram.setComputeUnitLimit({ units: 0 }));
  await ok(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
  await ok(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0 }));
  await bad(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_001 }));
  await bad(ComputeBudgetProgram.requestHeapFrame({ bytes: 64 * 1024 }));
  const cb = (data: number[]) => new TransactionInstruction({ programId: ComputeBudgetProgram.programId, keys: [], data: Buffer.from(data) });
  await bad(cb([2, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0])); // limit with a u64 body
  await bad(cb([3, 0x10, 0x27, 0, 0]));               // price with a u32 body
  await bad(cb([2, 0x40, 0x42, 0x0f]));                // truncated
  await bad(cb([]));
});

test("player nonce advance is allowed only first, and only the exact rent may return to the operator", async () => {
  const nonce = Keypair.generate().publicKey;
  const operator = new PublicKey(GAME_OPERATOR);
  const rent = 1_447_680;
  const advance = SystemProgram.nonceAdvance({ noncePubkey: nonce, authorizedPubkey: user.publicKey });
  const repay = SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: operator, lamports: rent });
  const rpc = rpcWith();
  rpc.getMinimumBalanceForRentExemption = async (size: number) => size === 80 ? rent : 0;
  const paid = await guard(transaction(advance, ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), repay, coreIx()), {}, rpc);
  assert.equal(paid.safe, true);
  assert.equal(paid.details?.lamportsSpent, 0);
  assert.equal((await guard(transaction(coreIx(), advance), {}, rpc)).safe, false, "advance must be first");
  assert.equal((await guard(transaction(SystemProgram.nonceWithdraw({
    noncePubkey: nonce, authorizedPubkey: user.publicKey, toPubkey: user.publicKey, lamports: 1,
  })), {}, rpc)).safe, false, "withdraw is not an advance");
  const extra = await guard(transaction(advance, SystemProgram.transfer({
    fromPubkey: user.publicKey, toPubkey: operator, lamports: rent + 1,
  }), coreIx()), {}, rpc);
  assert.equal(extra.safe, false, "rent refund must be the exact exemption");
  assert.equal((await guard(transaction(advance, SystemProgram.transfer({
    fromPubkey: user.publicKey, toPubkey: other, lamports: rent,
  })), {}, rpc)).safe, false, "rent must return only to the operator");
});

test("prep-mint policy: one user-funded classic mint uses auth PDA temporarily for mint/freeze, rent ceiling inclusive", async () => {
  const mint = Keypair.generate();
  const create = (over: Partial<{ from: PublicKey; lamports: number; space: number; programId: PublicKey; mint: PublicKey }> = {}) =>
    SystemProgram.createAccount({
      fromPubkey: over.from || user.publicKey, newAccountPubkey: over.mint || mint.publicKey, lamports: over.lamports ?? 1_461_600,
      space: over.space ?? 82, programId: over.programId || TOKEN_PROGRAM_ID,
    });
  const init = (decimals = 0, mintAuth = auth, freeze: PublicKey | null = auth, m = mint.publicKey) => createInitializeMintInstruction(m, decimals, mintAuth, freeze);
  const ata = () => createAssociatedTokenAccountIdempotentInstruction(user.publicKey, getAssociatedTokenAddressSync(mint.publicKey, user.publicKey), user.publicKey, mint.publicKey);
  const run = async (...ix: TransactionInstruction[]) => (await guard(transaction(...ix))).safe;

  assert.equal(await run(create(), init(), ata()), true);
  assert.equal(await run(create(), createInitializeMint2Instruction(mint.publicKey, 0, auth, auth), ata()), true, "InitializeMint2 is the same policy");
  assert.equal(await run(create({ lamports: 5_000_000 }), init(), ata()), true, "rent exactly at the ceiling");
  assert.equal(await run(create({ lamports: 5_000_001 }), init(), ata()), false, "rent above the ceiling");
  assert.equal(await run(create({ from: other }), init(), ata()), false, "someone else may not fund it");
  assert.equal(await run(create({ space: 165 }), init(), ata()), false, "only an 82-byte mint, not a token account");
  assert.equal(await run(create({ programId: TOKEN_2022_PROGRAM_ID }), init(), ata()), false, "owner must be the classic token program");
  assert.equal(await run(create(), init(1), ata()), false, "decimals must be 0");
  assert.equal(await run(create(), init(0, other), ata()), false, "mint authority must be the game's auth PDA");
  assert.equal(await run(create(), init(0, auth, null), ata()), false, "freeze authority must be the auth PDA");
  assert.equal(await run(create(), init(0, auth, other), ata()), false, "user-controlled freeze authority is forbidden");
  assert.equal(await run(create(), ata()), false, "allocation without initialisation");
  assert.equal(await run(init(), ata()), false, "initialisation without allocation");
  const second = Keypair.generate();
  assert.equal(await run(create(), init(), create({ mint: second.publicKey }), init(0, auth, auth, second.publicKey), ata()), false, "at most one mint per transaction");
  assert.equal(await run(create(), createInitializeMintInstruction(mint.publicKey, 0, auth, auth, TOKEN_2022_PROGRAM_ID), ata()), false, "Token-2022 needs its own reviewed policy");
});

test("ATA policy: idempotent creation only, paid by the wallet, canonical address, at most four per transaction", async () => {
  const mints = Array.from({ length: 5 }, () => Keypair.generate().publicKey);
  const idem = (mint: PublicKey, owner = user.publicKey, payer = user.publicKey, address = getAssociatedTokenAddressSync(mint, owner)) =>
    createAssociatedTokenAccountIdempotentInstruction(payer, address, owner, mint);
  const run = async (...ix: TransactionInstruction[]) => (await guard(transaction(...ix, coreIx()))).safe;
  assert.equal(await run(idem(mints[0])), true);
  assert.equal(await run(idem(mints[0], other)), true, "an ATA for another owner is fine as long as the wallet only pays rent");
  assert.equal(await run(...mints.slice(0, 4).map((m) => idem(m))), true, "four ATAs");
  assert.equal(await run(...mints.map((m) => idem(m))), false, "five ATAs");
  assert.equal(await run(createAssociatedTokenAccountInstruction(user.publicKey, getAssociatedTokenAddressSync(mints[0], user.publicKey), user.publicKey, mints[0])), false, "non-idempotent create");
  assert.equal(await run(idem(mints[0], user.publicKey, other)), false, "payer must be the wallet");
  assert.equal(await run(idem(mints[0], user.publicKey, user.publicKey, getAssociatedTokenAddressSync(mints[0], other))), false, "address must match owner+mint");
  const tampered = idem(mints[0]);
  tampered.keys[5] = { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false };
  assert.equal(await run(tampered), false, "token program slot must be the classic token program");
  const tamperedSystem = idem(mints[0]);
  tamperedSystem.keys[4] = { pubkey: other, isSigner: false, isWritable: false };
  assert.equal(await run(tamperedSystem), false);
  assert.equal(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
});

test("block lists: a blocked program or address in the transaction is a hard HIGH", async () => {
  const blockedProgram = await guard(transaction(coreIx()), { blockedPrograms: [core.toBase58()] });
  assert.equal(blockedProgram.safe, false);
  assert.equal(blockedProgram.risk, "HIGH");
  assert.match(blockedProgram.reason || "", /заблокированная программа/);
  const withKey = new TransactionInstruction({ programId: core, keys: [{ pubkey: other, isSigner: false, isWritable: false }], data: Buffer.alloc(8) });
  const blockedAddress = await guard(transaction(withKey), { blockedAddresses: [other.toBase58()] });
  assert.equal(blockedAddress.safe, false);
  assert.match(blockedAddress.reason || "", /заблокированный адрес/);
  assert.equal((await guard(transaction(withKey), { blockedAddresses: [Keypair.generate().publicKey.toBase58()] })).safe, true);
});

test("program allowlist is always enforced: CPI programs seen only in simulation logs count, and an empty list is not a bypass", async () => {
  const ok = await guard(transaction(coreIx()), {}, rpcWith({ logs: [`Program ${core.toBase58()} invoke [1]`, `Program ${core.toBase58()} success`] }));
  assert.equal(ok.safe, true);
  assert.deepEqual(ok.details?.programsInvoked, [core.toBase58()]);
  const cpi = await guard(transaction(coreIx()), {}, rpcWith({ logs: [`Program ${core.toBase58()} invoke [1]`, `Program ${other.toBase58()} invoke [2]`, `Program ${other.toBase58()} success`] }));
  assert.equal(cpi.safe, false, "an unknown program reached through CPI is still unknown");
  assert.match(cpi.reason || "", /Неизвестные программы/);
  assert.ok(cpi.details?.programsInvoked?.includes(other.toBase58()));
  const noise = await guard(transaction(coreIx()), {}, rpcWith({ logs: [`Program log: invoke ${other.toBase58()}`, "Program consumption: 1 units"] }));
  assert.equal(noise.safe, true, "only real invoke lines name programs");
  assert.equal((await guard(transaction(coreIx()), { allowedPrograms: [] })).safe, false, "empty allowlist = standard programs only");
  assert.equal((await guard(transaction(transfer(1)), { allowedPrograms: [] })).safe, true, "System Program is always standard");
  assert.equal((await guardTransaction(transaction(coreIx()), user.publicKey, {}, rpcWith())).safe, true, "the default config already allows the six game programs");
  assert.equal((await guardTransaction(transaction(new TransactionInstruction({ programId: other, keys: [], data: Buffer.alloc(8) })), user.publicKey, {}, rpcWith())).safe, false, "…and nothing else");
});

test("fee payer and v0 address lookups: the wallet must pay and resolved ALT keys are inspected", async () => {
  const paidByOther = new Transaction({ feePayer: other, recentBlockhash: other.toBase58() }).add(coreIx());
  const versionedOther = new VersionedTransaction(paidByOther.compileMessage());
  const result = await guard(versionedOther);
  assert.equal(result.safe, false);
  assert.match(result.reason || "", /Плательщик/);
  const legacyMessageWithBinaryData = new VersionedTransaction(transaction(new TransactionInstruction({
    programId: core, keys: [], data: Buffer.from([0, 7, 19, 23, 31, 42, 51, 60]),
  })).compileMessage());
  assert.equal((await guard(legacyMessageWithBinaryData)).safe, true, "legacy compiled instruction data is base58-decoded exactly");

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
  const instruction = new TransactionInstruction({
    programId: core,
    keys: [{ pubkey: other, isSigner: false, isWritable: false }],
    data: Buffer.alloc(8),
  });
  const oneLookup = new VersionedTransaction(new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: other.toBase58(),
    instructions: [instruction],
  }).compileToV0Message([lookupTable]));
  assert.equal(oneLookup.message.addressTableLookups.length, 1);
  assert.equal((await guard(oneLookup)).safe, false, "an unresolved/missing lookup table must fail closed");
  assert.equal((await guard(oneLookup, {}, rpcWith({ lookupTable }))).safe, true, "resolved readonly lookup account is decoded and simulated");
  const deactivated = new AddressLookupTableAccount({
    key: lookupTable.key,
    state: { ...lookupTable.state, deactivationSlot: 99n },
  });
  assert.equal((await guard(oneLookup, {}, rpcWith({ lookupTable: deactivated }))).safe, false, "deactivated tables are refused");
  const notYetActive = new AddressLookupTableAccount({
    key: lookupTable.key,
    state: { ...lookupTable.state, lastExtendedSlot: 100n },
  });
  assert.equal((await guard(oneLookup, {}, rpcWith({ lookupTable: notYetActive }))).safe, false, "same-slot table extensions are refused");

  const noLookup = new VersionedTransaction(new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: other.toBase58(),
    instructions: [coreIx()],
  }).compileToV0Message());
  assert.equal((await guard(noLookup)).safe, true);
  assert.equal((await guard(new Transaction({ feePayer: user.publicKey, recentBlockhash: other.toBase58() }))).safe, false, "empty transaction");
});

test('lottery claim/refund intents bind wallet, round, ticket and exact instruction before signing', async () => {
  const { lotteryPda } = await import('../src/lib/lotteryReadings');
  const { CORE_INSTRUCTIONS } = await import('../src/lib/coreInstructions');
  const roundId = '9007199254740993';
  const ticket = '42';
  const config = PublicKey.findProgramAddressSync([Buffer.from('config')], core)[0];
  const ixFor = (action: 'claim' | 'refund', id = roundId, n = ticket, owner = user.publicKey) => {
    const name = action === 'claim' ? 'claim_lottery_prize' : 'refund_lottery_ticket';
    const spec = CORE_INSTRUCTIONS.find(value => value.name === name)!;
    return new TransactionInstruction({ programId: core, data: Buffer.from(spec.discriminator), keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(lotteryPda('lottery_round', id)), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(lotteryPda('lottery_ticket', id, n)), isSigner: false, isWritable: action === 'refund' },
      { pubkey: owner, isSigner: action === 'claim', isWritable: true },
    ] });
  };
  const intent = (action: 'claim' | 'refund', changes: Record<string, string> = {}) =>
    ({ kind: 'lotteryTicket', action, user: user.publicKey.toBase58(), roundId, ticketNumber: ticket, ...changes } as const);
  for (const action of ['claim', 'refund'] as const) {
    assert.equal((await guard(transaction(ixFor(action)), { intent: intent(action) })).safe, true);
    assert.equal((await guard(transaction(ixFor(action, '0', '0')), { intent: intent(action, { roundId: '0', ticketNumber: '0' }) })).safe, true,
      'existing round zero must remain claimable or refundable');
    for (const [description, ix, expected] of [
      ['wrong round', ixFor(action, '2'), intent(action)],
      ['wrong ticket', ixFor(action, roundId, '43'), intent(action)],
      ['wrong recipient', ixFor(action, roundId, ticket, other), intent(action)],
      ['wrong wallet intent', ixFor(action), intent(action, { user: other.toBase58() })],
      ['wrong action', ixFor(action), intent(action === 'claim' ? 'refund' : 'claim')],
    ] as const) {
      assert.equal((await guard(transaction(ix), { intent: expected })).safe, false, `${action}: ${description}`);
    }
    assert.equal((await guard(transaction(ixFor(action), SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: other, lamports: 1 })),
      { intent: intent(action) })).safe, false, `${action}: extra payment`);
    const extra = ixFor(action); extra.data = Buffer.concat([extra.data, Buffer.from([1])]);
    assert.equal((await guard(transaction(extra), { intent: intent(action) })).safe, false, `${action}: unexpected data`);
  }
});


test('season XP claim: bound campaign/genesis digests, exact on-chain arguments/accounts, live cluster and expiry', async () => {
  const { CORE_INSTRUCTIONS } = await import('../src/lib/coreInstructions');
  const { expectedPayerRentAccounts } = await import('../src/lib/transactionIntent');
  const { webcrypto } = await import('node:crypto');
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

  const userAddress = user.publicKey.toBase58();
  const authority = Keypair.generate().publicKey;
  const genesis = Keypair.generate().publicKey.toBase58();
  const seasonId = 71;
  const amount = 2_500;
  const nonce = 4;
  const expirySlot = '1000';
  const campaignId = 'season-71-daily:4';
  const digest = (domain: string, value: string) => createHash('sha256').update(`${domain}\0${value}`, 'utf8').digest();
  const campaignDigest = digest('AOF_SEASON_XP_CAMPAIGN_V1', campaignId);
  const genesisHashDigest = digest('AOF_SEASON_XP_GENESIS_V1', genesis);
  const entitlementId = Buffer.alloc(32, 0x75);
  const seasonBytes = Buffer.alloc(4); seasonBytes.writeUInt32LE(seasonId);
  const season = PublicKey.findProgramAddressSync([Buffer.from('season'), seasonBytes], core)[0];
  const seasonPass = PublicKey.findProgramAddressSync([Buffer.from('season_pass'), user.publicKey.toBuffer(), seasonBytes], core)[0];
  const cursor = PublicKey.findProgramAddressSync([Buffer.from('season_xp_claim_cursor'), user.publicKey.toBuffer(), seasonBytes], core)[0];
  const config = PublicKey.findProgramAddressSync([Buffer.from('config')], core)[0];
  const instructionSpec = CORE_INSTRUCTIONS.find((entry) => entry.name === 'grant_season_xp');
  assert.ok(instructionSpec, 'generated instruction table contains the XP grant');
  const data = Buffer.alloc(124);
  Buffer.from(instructionSpec.discriminator).copy(data, 0);
  data.writeUInt32LE(amount, 8);
  data.writeUInt32LE(seasonId, 12);
  data.writeUInt32LE(nonce, 16);
  data.writeBigUInt64LE(BigInt(expirySlot), 20);
  campaignDigest.copy(data, 28);
  entitlementId.copy(data, 60);
  genesisHashDigest.copy(data, 92);
  const ix = new TransactionInstruction({
    programId: core,
    data,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: season, isSigner: false, isWritable: false },
      { pubkey: seasonPass, isSigner: false, isWritable: true },
      { pubkey: cursor, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
  const tx = transaction(ix);
  const expectedRent = expectedPayerRentAccounts({
    kind: 'seasonXpClaim', user: userAddress, authority: authority.toBase58(), seasonId, amount,
    campaignId, campaignDigest: campaignDigest.toString('hex'), entitlementId: entitlementId.toString('hex'),
    nonce, expirySlot, clusterGenesisHash: genesis, programId: core.toBase58(),
    genesisHashDigest: genesisHashDigest.toString('hex'), quote: {} as any,
  });
  const rentAccounts = expectedRent.map((account) => ({
    name: account.name,
    address: account.address.toBase58(),
    size: account.size,
    strategy: account.strategy,
    exists: false,
    rentDueLamports: '100000',
    maxRentLamports: '100000',
  }));
  const quote = {
    version: 1 as const,
    payer: userAddress,
    recentBlockhash: tx.recentBlockhash!,
    lastValidBlockHeight: 200,
    messageSha256: createHash('sha256').update(tx.serializeMessage()).digest('hex'),
    networkFeeLamports: '10000',
    rentLamports: '200000',
    maxRentLamports: '200000',
    maxCostLamports: '210000',
    rentAccounts,
  };
  const intent = {
    kind: 'seasonXpClaim' as const, user: userAddress, authority: authority.toBase58(), seasonId, amount,
    campaignId, campaignDigest: campaignDigest.toString('hex'), entitlementId: entitlementId.toString('hex'),
    nonce, expirySlot, clusterGenesisHash: genesis, programId: core.toBase58(),
    genesisHashDigest: genesisHashDigest.toString('hex'), quote,
  };
  const makeRpc = (over: { genesis?: string; slot?: number; height?: number } = {}): any => ({
    getGenesisHash: async () => over.genesis ?? genesis,
    getSlot: async () => over.slot ?? 999,
    getFeeForMessage: async () => ({ value: 10_000 }),
    getBlockHeight: async () => over.height ?? 100,
    getAccountInfo: async () => null,
    getMinimumBalanceForRentExemption: async () => 100_000,
    simulateTransaction: async () => ({ value: { err: null, logs: [] } }),
  });

  assert.equal((await guard(tx, { intent }, makeRpc())).safe, true, 'a correct authority-signed entitlement reaches the wallet');
  assert.equal((await guard(tx, { intent: { ...intent, campaignDigest: '00'.repeat(32) } }, makeRpc())).safe, false,
    'campaign metadata cannot drift away from the authority-signed digest');
  assert.equal((await guard(tx, { intent: { ...intent, clusterGenesisHash: other.toBase58() } }, makeRpc())).safe, false,
    'wrong genesis target is rejected before wallet signing');
  assert.equal((await guard(tx, { intent }, makeRpc({ genesis: other.toBase58() }))).safe, false,
    'live RPC genesis must match the signed entitlement');
  assert.equal((await guard(tx, { intent }, makeRpc({ slot: 1001 }))).safe, false,
    'expired slot is rejected');
  assert.equal((await guard(tx, { intent: { ...intent, programId: other.toBase58() } }, makeRpc())).safe, false,
    'wrong program is rejected');
  assert.equal((await guard(tx, { intent: { ...intent, amount: amount + 1 } }, makeRpc())).safe, false,
    'a changed XP amount is rejected');
  assert.equal((await guard(transaction(new TransactionInstruction({ ...ix, keys: ix.keys.map((key, index) =>
    index === 3 ? { ...key, pubkey: other } : key) })), { intent }, makeRpc())).safe, false,
    'a different season account is rejected');
  assert.equal((await guard(transaction(ix, SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: other, lamports: 1 })),
    { intent }, makeRpc())).safe, false, 'an extra top-level action is rejected');
});
