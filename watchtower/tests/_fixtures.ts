/** Deterministic fixture rows shaped exactly like ChainEvent / ChainTx. */
import { Keypair } from "@solana/web3.js";
import { createHash } from "node:crypto";

const kp = (seed: string) => Keypair.fromSeed(createHash("sha256").update(seed).digest()).publicKey.toBase58();
const sig = (n: number) => Buffer.from(createHash("sha512").update(`sig${n}`).digest()).toString("base64").replace(/[^1-9A-HJ-NP-Za-km-z]/g, "").padEnd(87, "1").slice(0, 87);
export const CORE = "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
export const MARKET = "4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo";
export const QUESTS = "4fNKhVw2nErWZBBw9hgWD3Metu1UKbDLdhFGWbCewdLU";
export const W = { alice: kp("alice"), bob: kp("bob"), authority: kp("authority"), treasury: kp("treasury") };
export const M = { potato: kp("potato-mint"), wood: kp("wood-mint"), tool1: kp("tool-1"), tool2: kp("tool-2"), mascot: kp("mascot") };
const t0 = Date.parse("2026-09-20T10:00:00Z");
const row = (n: number, programId: string, eventType: string, data: Record<string, unknown>, o: { wallet?: string | null; mint?: string | null; amount?: string | null } = {}) => ({
  signature: sig(n), eventIndex: 0, slot: BigInt(400_000_000 + n), blockTime: new Date(t0 + n * 60_000), programId, eventType,
  wallet: o.wallet ?? null, mint: o.mint ?? null, amount: o.amount ?? null, success: true, data,
});

export const EVENTS = [
  row(1, CORE, "ToolMinted", { to: W.alice, mint: M.tool1, toolType: 2, rarity: 1 }, { wallet: W.alice, mint: M.tool1 }),
  row(2, CORE, "MiningCollected", { user: W.alice, toolMint: M.tool1, resourceMint: M.wood, hours: 4, amount: "8000000000", durabilityAfter: 96 }, { wallet: W.alice, mint: M.wood, amount: "8000000000" }),
  row(3, CORE, "ListingSold", { seller: W.alice, buyer: W.bob, mint: M.tool1, priceLamports: "250000000" }, { wallet: W.alice, mint: M.tool1, amount: "250000000" }),
  row(4, CORE, "ResourceIssued", { kind: 26, mint: M.potato, recipient: W.bob, gross: "5000000000", fee: "400000000", mintedInEpoch: "5000000000", capPerEpoch: "1000000000000", epochStartSlot: "399999000", slot: "400000004" }, { mint: M.potato, amount: "5000000000" }),
  row(5, CORE, "ToolCrafted", { user: W.bob, burnedMint: M.tool1, mintedMint: M.tool2, rarity: 2, woodCost: "3000000000", stoneCost: "1000000000", mintedCountAfter: 17 }, { wallet: W.bob, mint: M.tool2 }),
  row(6, CORE, "IssuanceCapChanged", { kind: 26, epochSlots: "216000", capPerEpoch: "0", mintedInEpoch: "5000000000", slot: "400000006" }, { mint: null }),
  row(7, MARKET, "HotMarketBought", { buyer: W.bob, rarity: 1, currency: "core", price: "120000000", soldSinceStart: 3 }, { wallet: W.bob, amount: "120000000" }),
  row(8, QUESTS, "QuestRewardClaimed", { user: W.alice, questId: 7, rewardMascot: M.mascot }, { wallet: W.alice, mint: M.mascot }),
  row(9, CORE, "ReferralBound", { referrer: W.alice, referred: W.bob }, { wallet: W.alice }),
  row(10, CORE, "PackOpened", { user: W.bob, mint: M.tool2, packType: 1, rarity: 3, toolType: 4 }, { wallet: W.bob, mint: M.tool2 }),
  row(11, CORE, "GasFeesSwept", { to: W.treasury, amountLamports: "9000000" }, { wallet: W.treasury, amount: "9000000" }),
  row(12, CORE, "AuctionCreated", { seller: W.alice, mint: M.tool2, minBid: "1", endTime: "1790000000" }, { wallet: W.alice }), // intentionally ignored
  row(13, CORE, "Staked", { user: W.alice, mint: M.tool2 }, { wallet: W.alice, mint: M.tool2 }),
];

export const TXS = [
  { signature: sig(1), slot: BigInt(400_000_001), blockTime: new Date(t0 + 60_000), success: true, feePayer: W.alice, errorJson: null, programIds: JSON.stringify([CORE]) },
  { signature: sig(99), slot: BigInt(400_000_099), blockTime: new Date(t0 + 99 * 60_000), success: false, feePayer: W.bob, errorJson: JSON.stringify({ InstructionError: [0, { Custom: 6098 }] }), programIds: JSON.stringify([CORE]) },
];
export const SALT = "fixture-salt";
