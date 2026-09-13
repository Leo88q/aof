import { z } from "zod";

// Общие схемы для переиспользования
export const pubkeySchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid base58 pubkey");

export const amountSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a decimal string")
  .refine((s) => BigInt(s) > 0n, "Amount must be > 0");

export const amountOrZeroSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a decimal string");

export const raritySchema = z.number().int().min(1).max(4);
export const rarityIndexSchema = z.number().int().min(0).max(4);
export const bpsSchema = z.number().int().min(0).max(10000);
export const smallIntSchema = z.number().int().min(0).max(255);

// Схемы для ключевых эндпоинтов
export const adminInitializeSchema = z.object({}).strict();

export const setResourceMintsSchema = z.object({
  foodMint: pubkeySchema,
  woodMint: pubkeySchema,
  stoneMint: pubkeySchema,
}).strict();

export const gastankDepositSchema = z.object({
  user: pubkeySchema,
  amount: amountSchema,
}).strict();

export const hotMarketBuySchema = z.object({
  buyer: pubkeySchema,
  rarity: raritySchema,
  toolMint: pubkeySchema,
  priceSnapshot: amountSchema,
  slippageBps: z.number().int().min(0).max(5000).optional(),
}).strict();

export const hotMarketPoolInitSchema = z.object({
  rarity: raritySchema,
  basePricePotato: amountSchema,
  basePriceSolLamports: amountSchema,
  growthPerPurchaseBps: bpsSchema,
  decayPerHourBps: bpsSchema,
  targetSalesPerHour: z.number().int().min(1).max(1000),
  feeBps: bpsSchema,
}).strict();

export const questInitSchema = z.object({
  questId: z.number().int().min(0).max(1000000),
  rewardPotato: amountSchema,
}).strict();

export const sessionCreateSchema = z.object({
  authority: pubkeySchema,
  sessionSigner: pubkeySchema,
  allowedIxs: amountSchema,
  maxAmountPerTx: amountSchema,
  ttlSeconds: amountSchema.refine(
    (s) => BigInt(s) <= 30n * 24n * 3600n,
    "TTL cannot exceed 30 days"
  ),
}).strict();

export const energySpendSchema = z.object({
  user: pubkeySchema,
  amount: z.number().int().min(1).max(100).optional(),
}).strict();

export const inboxCreateSchema = z.object({
  user: pubkeySchema,
  sender: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  rewardType: z.string().max(50).optional(),
  rewardAmount: z.number().int().min(0).optional(),
  ttlHours: z.number().int().min(1).max(720).optional(),
}).strict();

export const compendiumMarkSeenSchema = z.object({
  user: pubkeySchema,
  toolType: z.enum(["axe", "pick", "spear", "bow", "reaper"]),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
}).strict();
