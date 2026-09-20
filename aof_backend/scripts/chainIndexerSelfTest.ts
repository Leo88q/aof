/**
 * Chain indexer core self-test: real Anchor event encoding through the
 * committed IDLs, CPI-aware log parsing, actor/mint/amount extraction,
 * per-tx supply deltas from token balances, and dedup key stability.
 *
 * Run: npm run test:chain-indexer
 */
import assert from "node:assert/strict";
import { BorshCoder, BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import coreIdl from "../src/idl/aof_core.json";
import marketIdl from "../src/idl/aof_market.json";
import questsIdl from "../src/idl/aof_quests.json";
import { EventDecoder, hashWallet, mintDeltas, normalize, touchedPrograms } from "../src/lib/chainIndexerCore";

const CORE = (coreIdl as any).address as string;
const MARKET = (marketIdl as any).address as string;
const QUESTS = (questsIdl as any).address as string;

// Anchor 0.30's BorshEventCoder is decode-only; build the wire format the
// same way the program does: 8-byte discriminator from the IDL + borsh body.
// Field names must be the IDL's snake_case here; the decoder camelCases them.
function encodeEvent(idl: any, coder: BorshCoder, name: string, data: any): string {
  const ev = idl.events.find((e: any) => e.name === name);
  if (!ev) throw new Error(`event ${name} not in IDL`);
  const body = coder.types.encode(name, data);
  return Buffer.concat([Buffer.from(ev.discriminator), body]).toString("base64");
}

function programLogs(programId: string, dataLines: string[], depth = 1): string[] {
  return [
    `Program ${programId} invoke [${depth}]`,
    ...dataLines.map((d) => `Program data: ${d}`),
    `Program ${programId} consumed 1234 of 200000 compute units`,
    `Program ${programId} success`,
  ];
}

async function main() {
  const coreCoder = new BorshCoder(coreIdl as any);
  const marketCoder = new BorshCoder(marketIdl as any);
  const questsCoder = new BorshCoder(questsIdl as any);
  const decoder = new EventDecoder([
    { programId: CORE, name: "aof_core", idl: coreIdl as any },
    { programId: MARKET, name: "aof_market", idl: marketIdl as any },
    { programId: QUESTS, name: "aof_quests", idl: questsIdl as any },
  ]);

  const user = Keypair.generate().publicKey;
  const toolMint = Keypair.generate().publicKey;
  const resourceMint = Keypair.generate().publicKey;

  // --- 1. Single core event: actor, mint and amount are extracted ---------
  const mining = encodeEvent(coreIdl, coreCoder, "MiningCollected", {
    user, tool_mint: toolMint, resource_mint: resourceMint, hours: 8, amount: new BN("123456789012"), durability_after: 17,
  } as any);
  const evs = decoder.decode(programLogs(CORE, [mining]));
  assert.equal(evs.length, 1);
  assert.equal(evs[0].eventType, "MiningCollected");
  assert.equal(evs[0].programId, CORE);
  assert.equal(evs[0].wallet, user.toBase58());
  assert.equal(evs[0].walletHash, hashWallet(user.toBase58()));
  assert.equal(evs[0].mint, toolMint.toBase58(), "mint prefers `mint`/`toolMint` over resourceMint");
  assert.equal(evs[0].amount, "123456789012");
  assert.equal(evs[0].data.resourceMint, resourceMint.toBase58());
  assert.equal(evs[0].data.durabilityAfter, 17);

  // --- 2. Multi-program tx with CPI: each event attributed to its program --
  const bought = encodeEvent(marketIdl, marketCoder, "HotMarketBought", {
    buyer: user, rarity: 2, currency: { Gem: {} }, price: new BN(5000), sold_since_start: new BN(3),
  } as any);
  const quest = encodeEvent(questsIdl, questsCoder, "QuestRewardClaimed", { user, quest_id: 7, reward_mascot: new BN(1) } as any);
  const paidOut = encodeEvent(coreIdl, coreCoder, "PaidOut", { user, amount: new BN(42), vault_balance_after: new BN(1000) } as any);
  const logs = [
    `Program ${MARKET} invoke [1]`,
    `Program data: ${bought}`,
    `Program ${CORE} invoke [2]`,          // CPI into core
    `Program data: ${paidOut}`,
    `Program ${CORE} success`,
    `Program ${MARKET} success`,
    ...programLogs(QUESTS, [quest]),
    // An unrelated program emitting an event must be ignored.
    ...programLogs("11111111111111111111111111111111", [paidOut]),
  ];
  const multi = decoder.decode(logs);
  const types = multi.map((e) => `${e.programId === CORE ? "core" : e.programId === MARKET ? "market" : "quests"}:${e.eventType}`).sort();
  assert.deepEqual(types, ["core:PaidOut", "market:HotMarketBought", "quests:QuestRewardClaimed"]);
  // Dedup key: (signature, eventIndex) unique within the tx and stable across runs.
  const idx = multi.map((e) => e.eventIndex);
  assert.equal(new Set(idx).size, idx.length);
  assert.deepEqual(decoder.decode(logs).map((e) => e.eventIndex), idx);
  const market = multi.find((e) => e.eventType === "HotMarketBought")!;
  assert.equal(market.wallet, user.toBase58());
  assert.equal(market.amount, "5000", "price is used as amount for market events");
  assert.equal(market.mint, null);
  assert.deepEqual(market.data.currency, { Gem: {} }, "enum variants survive normalization");

  // --- 3. Garbage / empty logs never throw ----------------------------------
  assert.deepEqual(decoder.decode(null), []);
  assert.deepEqual(decoder.decode([`Program ${CORE} invoke [1]`, "Program data: !!!not-base64!!!", `Program ${CORE} success`]), []);
  assert.deepEqual(decoder.decode([`Program ${CORE} invoke [1]`, "Program log: hello", `Program ${CORE} success`]), []);

  // --- 4. Supply deltas from token balances ---------------------------------
  const potato = Keypair.generate().publicKey.toBase58();
  const wood = Keypair.generate().publicKey.toBase58();
  const tb = (mint: string, amount: string) => ({ mint, uiTokenAmount: { amount } });
  // transfer 100 potato A->B (no supply change), mint 50 wood to C, burn 30 potato from D
  const pre = [tb(potato, "100"), tb(potato, "0"), tb(wood, "10"), tb(potato, "30")];
  const post = [tb(potato, "0"), tb(potato, "100"), tb(wood, "60"), tb(potato, "0")];
  const deltas = mintDeltas(pre, post).sort((a, b) => a.mint.localeCompare(b.mint));
  assert.deepEqual(deltas, [{ mint: potato, delta: -30n }, { mint: wood, delta: 50n }].sort((a, b) => a.mint.localeCompare(b.mint)));
  assert.deepEqual(mintDeltas(pre, post, new Set([wood])), [{ mint: wood, delta: 50n }]);
  // Newly created ATA appears only in post; closed ATA only in pre.
  assert.deepEqual(mintDeltas([], [tb(wood, "7")]), [{ mint: wood, delta: 7n }]);
  assert.deepEqual(mintDeltas([tb(wood, "7")], []), [{ mint: wood, delta: -7n }]);
  assert.deepEqual(mintDeltas(null, undefined), []);
  // u64 max does not overflow
  assert.deepEqual(mintDeltas([], [tb(wood, "18446744073709551615")]), [{ mint: wood, delta: 18446744073709551615n }]);

  // --- 5. touchedPrograms + normalize ---------------------------------------
  const keys = [user.toBase58(), CORE, "11111111111111111111111111111111", MARKET];
  assert.deepEqual(touchedPrograms(keys, [1, 2, 3, 1], new Set([CORE, MARKET, QUESTS])).sort(), [CORE, MARKET].sort());
  assert.deepEqual(normalize({ a: new BN("99"), b: user, c: { food: {} }, d: [1n, "x"], e: Buffer.from([1, 2]) }),
    { a: "99", b: user.toBase58(), c: { food: {} }, d: ["1", "x"], e: "0102" });

  // --- 6. Wallet hash is salted and stable ----------------------------------
  assert.equal(hashWallet("W", "s1"), hashWallet("W", "s1"));
  assert.notEqual(hashWallet("W", "s1"), hashWallet("W", "s2"));

  console.log("chain indexer tests: IDL event round-trip, CPI attribution, stable dedup indexes, actor/mint/amount extraction, token-balance supply deltas and normalization passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
