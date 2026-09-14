import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../config";
import BN from "bn.js";

const enc = (s: string) => Buffer.from(s, "utf8");
const u8 = (n: number) => Buffer.from([n]);
const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
};
const u64le = (n: BN | bigint | number | string) => {
  const b = Buffer.alloc(8);
  let big: bigint;
  if (typeof n === "bigint") {
    big = n;
  } else if (typeof n === "number" || typeof n === "string") {
    big = BigInt(n);
  } else {
    big = BigInt(n.toString());
  }
  b.writeBigUInt64LE(big, 0);
  return b;
};
const find = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);

const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const programDataFor = (programId: PublicKey) =>
  PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_LOADER_UPGRADEABLE_PROGRAM_ID);

export const configPda = () => find([enc("config")]);
export const authPda = () => find([enc("auth")]);
export const vaultPda = () => find([enc("vault")]);

// Upgradeable-loader ProgramData for the core program. Initialize is bound to
// this account on-chain, so the first Config authority cannot be front-run by
// an arbitrary signer.
export const programDataPda = () => programDataFor(PROGRAM_ID);

export const playerPda = (owner: PublicKey) => find([enc("player"), owner.toBuffer()]);
export const gastankPda = (owner: PublicKey) => find([enc("gastank"), owner.toBuffer()]);
export const toolPda = (mint: PublicKey) => find([enc("tool"), mint.toBuffer()]);
export const rarityCounterPda = (rarity: number) => find([enc("rarity_counter"), u8(rarity)]);
export const craftEconomyPda = () => find([enc("craft_economy")]);
export const collectorPda = (mint: PublicKey) => find([enc("collector"), mint.toBuffer()]);
export const packConfigPda = (packType: number) => find([enc("pack_config"), u8(packType)]);
export const packCommitPda = (mint: PublicKey) => find([enc("pack_commit"), mint.toBuffer()]);
export const rerollConfigPda = () => find([enc("reroll_config")]);
export const rerollCommitPda = (newMint: PublicKey) => find([enc("reroll_commit"), newMint.toBuffer()]);
export const explorationStatePda = (owner: PublicKey) => find([enc("exploration_state"), owner.toBuffer()]);
export const explorationCommitPda = (toolMint: PublicKey) => find([enc("exploration_commit"), toolMint.toBuffer()]);
export const referralLinkPda = (referred: PublicKey) => find([enc("referral_link"), referred.toBuffer()]);
export const referrerStatsPda = (referrer: PublicKey) => find([enc("referrer_stats"), referrer.toBuffer()]);
export const enchantSlotPda = (toolMint: PublicKey, slotType: number) =>
  find([enc("enchant_slot"), toolMint.toBuffer(), u8(slotType)]);
export const forgeCommitPda = (toolMint: PublicKey, slotType: number) =>
  find([enc("forge_commit"), toolMint.toBuffer(), u8(slotType)]);
export const lotteryRoundPda = (roundId: BN | bigint | number | string) =>
  find([enc("lottery_round"), u64le(roundId)]);
export const lotteryTicketPda = (
  roundId: BN | bigint | number | string,
  ticketNumber: BN | bigint | number | string
) => find([enc("lottery_ticket"), u64le(roundId), u64le(ticketNumber)]);
export const listingPda = (mint: PublicKey) => find([enc("listing"), mint.toBuffer()]);
export const auctionPda = (mint: PublicKey) => find([enc("auction"), mint.toBuffer()]);
export const offerPda = (mint: PublicKey, buyer: PublicKey) =>
  find([enc("offer"), mint.toBuffer(), buyer.toBuffer()]);
export const rentalListingPda = (mint: PublicKey) => find([enc("rental_listing"), mint.toBuffer()]);
export const rentalAgreementPda = (mint: PublicKey) => find([enc("rental_agreement"), mint.toBuffer()]);
export const resourceOrderPda = (maker: PublicKey, mint: PublicKey) =>
  find([enc("resource_order"), maker.toBuffer(), mint.toBuffer()]);
export const craftOrderPda = (creator: PublicKey) => find([enc("craft_order"), creator.toBuffer()]);
export const seasonPda = (seasonId: number) => find([enc("season"), u32le(seasonId)]);
export const seasonPassPda = (owner: PublicKey, seasonId: number) =>
  find([enc("season_pass"), owner.toBuffer(), u32le(seasonId)]);

// ============================================================
// PDA для программы aof-market
// ============================================================
import marketIdl from "../idl/aof_market.json";
const MARKET_PROGRAM_ID_LOCAL = new PublicKey(marketIdl.address);
export const marketProgramDataPda = () => programDataFor(MARKET_PROGRAM_ID_LOCAL);

const findMarket = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, MARKET_PROGRAM_ID_LOCAL);

export const marketConfigPda = () => findMarket([enc("market_config")]);
export const hotMarketPoolPda = (rarity: number) =>
  findMarket([enc("hot_pool"), u8(rarity)]);
// Kept as a compatibility helper for old clients. The current contract has no
// queue PDA; callers must treat the returned address as unavailable.
export const hotMarketQueuePda = (rarity: number) =>
  findMarket([enc("hot_queue_legacy"), u8(rarity)]);
export const potatoConfigPda = marketConfigPda;

// ============================================================
// PDA для программы aof-session-keys
// ============================================================
import sessionIdl from "../idl/aof_session_keys.json";
const SESSION_PROGRAM_ID_LOCAL = new PublicKey(sessionIdl.address);
export const sessionProgramDataPda = () => programDataFor(SESSION_PROGRAM_ID_LOCAL);
const findSession = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, SESSION_PROGRAM_ID_LOCAL);

export const sessionConfigPda = () => findSession([enc("sk_config")]);
export const sessionTokenPda = (authority: PublicKey, _sessionSigner?: PublicKey) =>
  findSession([enc("session"), authority.toBuffer()]);
export const trustSnapshotPda = (user: PublicKey) =>
  findSession([enc("trust_snapshot"), user.toBuffer()]);

// ============================================================
// PDA для программы aof-quests
// ============================================================
import questsIdl from "../idl/aof_quests.json";
const QUESTS_PROGRAM_ID_LOCAL = new PublicKey(questsIdl.address);
export const questsProgramDataPda = () => programDataFor(QUESTS_PROGRAM_ID_LOCAL);

const findQuests = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, QUESTS_PROGRAM_ID_LOCAL);

export const questConfigPda = () => findQuests([enc("quest_config")]);
export const questTemplatePda = (questId: number) =>
  findQuests([enc("quest_template"), u32le(questId)]);
export const questProgressPda = (user: PublicKey, questId: number) =>
  findQuests([enc("quest_progress"), user.toBuffer(), u32le(questId)]);
export const achievementRecordPda = (user: PublicKey, achievementId: number) =>
  findQuests([enc("achievement"), user.toBuffer(), u32le(achievementId)]);
export const challengeRoundPda = (weekNumber: number) =>
  findQuests([enc("challenge_round"), u32le(weekNumber)]);
export const challengeContributionPda = (user: PublicKey, weekNumber: number) =>
  findQuests([enc("challenge_contrib"), user.toBuffer(), u32le(weekNumber)]);
export const drumCommitPda = (user: PublicKey) =>
  findQuests([enc("drum_commit"), user.toBuffer()]);

// ============================================================
// PDA для программы aof-rebirth
// ============================================================
import rebirthIdl from "../idl/aof_rebirth.json";
const REBIRTH_PROGRAM_ID_LOCAL = new PublicKey(rebirthIdl.address);
export const rebirthProgramDataPda = () => programDataFor(REBIRTH_PROGRAM_ID_LOCAL);

const findRebirth = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, REBIRTH_PROGRAM_ID_LOCAL);

export const rebirthConfigPda = () => findRebirth([enc("rebirth_config")]);
export const rebirthRecordPda = (user: PublicKey) =>
  findRebirth([enc("rebirth_record"), user.toBuffer()]);

// ============================================================
// PDA для программы aof-liquidity
// ============================================================
import liquidityIdl from "../idl/aof_liquidity.json";
const LIQUIDITY_PROGRAM_ID_LOCAL = new PublicKey(liquidityIdl.address);
export const liquidityProgramDataPda = () => programDataFor(LIQUIDITY_PROGRAM_ID_LOCAL);

const findLiquidity = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, LIQUIDITY_PROGRAM_ID_LOCAL);

export const lpConfigPda = () => findLiquidity([enc("lp_config")]);
export const lpPoolPda = (rarity: number) =>
  findLiquidity([enc("lp_pool"), u8(rarity)]);
export const lpPositionPda = (user: PublicKey, rarity: number) =>
  findLiquidity([enc("lp_position"), user.toBuffer(), u8(rarity)]);

// Bow/скины (добавлено из aof_solana_fixed)
export const bowCommitPda = (toolMint: PublicKey) => find([enc("bow_commit"), toolMint.toBuffer()]);
export const skinPda = (skinMint: PublicKey) => find([enc("skin"), skinMint.toBuffer()]);

// =====================================================================
// [БЛОК L] Хлебная экономика: новые PDA-хелперы
// =====================================================================
export const materialMintsPda = () => find([enc("material_mints")]);
export const energyAccountPda = (owner: PublicKey) => find([enc("energy_account"), owner.toBuffer()]);
export const farmTilePda = (owner: PublicKey, tileIndex: number) =>
  find([enc("farm_tile"), owner.toBuffer(), u8(tileIndex)]);
export const weatherStatePda = () => find([enc("weather_state")]);
export const wellStatePda = (owner: PublicKey) => find([enc("well_state"), owner.toBuffer()]);
export const millStatePda = (owner: PublicKey) => find([enc("mill_state"), owner.toBuffer()]);
export const ovenStatePda = (owner: PublicKey) => find([enc("oven_state"), owner.toBuffer()]);
export const loveProgressPda = (owner: PublicKey) => find([enc("love_progress"), owner.toBuffer()]);
export const fortuneBoostPda = (owner: PublicKey) => find([enc("fortune_boost"), owner.toBuffer()]);
