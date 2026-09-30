import { PublicKey } from "@solana/web3.js";
import { positiveU64 } from "./amounts";
import { coreInstructionSpec } from "./coreInstructions";

export const CORE_PROGRAM_ID = "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
/** aof-rebirth: постоянный бонус и запись поколения. Идентификатор совпадает
 * с остальными гвардами (Anchor.toml / txGuard AOF_PROGRAMS). */
export const REBIRTH_PROGRAM_ID = "4rMWC1h9mt6JTfBsUPYLMCydPED4e31cffmix5nZyuRb";
/** `do_rebirth` — байты взяты из aof_backend/src/idl/aof_rebirth.json; тест
 * `readiness/rebirth-reset.test.cjs` сверяет их с IDL, чтобы константа не
 * разъехалась с программой молча. */
export const REBIRTH_DO_DISCRIMINATOR = [76, 11, 54, 198, 197, 72, 21, 13] as const;
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = "11111111111111111111111111111111";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
export const MARKETPLACE_BUY_DISCRIMINATOR = [219, 1, 7, 251, 90, 189, 167, 48] as const;

export interface MarketplaceBuyIntent {
  readonly kind: "marketplaceBuy";
  readonly buyer: string;
  readonly seller: string;
  readonly treasury: string;
  readonly mint: string;
  readonly maxPriceLamports: string;
  readonly expiresAt: string;
}
/**
 * [F-06] Paid pack opening, co-signed by the game operator. The wallet only
 * signs if the transaction is exactly one pack_open_commit for this wallet,
 * pack type and the price ceiling the player accepted on screen.
 */
export interface PackOpenIntent {
  readonly kind: "packOpen";
  readonly user: string;
  readonly packType: number;
  readonly maxPriceLamports: string;
}
export interface SeasonPassIntent {
  readonly kind: "seasonPass";
  readonly user: string;
  readonly treasury: string;
  readonly seasonId: number;
  readonly priceLamports: "150000000";
}
/**
 * Lottery tickets: a purchase is signed with the ceiling the player saw, so a
 * changed constant (or a substituted backend response) can never charge more
 * than the screen showed; claim/refund stay bound to an already-owned ticket.
 * `ticketNumber` is the round's `tickets_sold` at quote time — the program
 * derives `lottery_ticket` and the per-wallet counter from it, so any other
 * value produces different PDAs and the intent check fails.
 */
export type LotteryTicketIntent =
  | { readonly kind: "lotteryTicket"; readonly action: "claim" | "refund"; readonly user: string; readonly roundId: string; readonly ticketNumber: string }
  | { readonly kind: "lotteryTicket"; readonly action: "buy"; readonly user: string; readonly roundId: string; readonly ticketNumber: string; readonly maxPriceLamports: string };
/**
 * Газ-бак: пополнение/вывод SOL. Игрок подтверждает на экране точную сумму, а
 * кошелёк подписывает только инструкцию своего бака с этой же суммой — иначе
 * подменённый ответ бэкенда мог списать больше показанного.
 * Единицы повторяют контракт: депозит — лампорты, вывод — микро (1e6 на SOL).
 */
export type GasTankIntent =
  | { readonly kind: "gasTank"; readonly action: "deposit"; readonly user: string; readonly amountLamports: string }
  | { readonly kind: "gasTank"; readonly action: "withdraw"; readonly user: string; readonly amountMicros: string };
/**
 * Коллекционеры: NFT уходит в vault PDA на 3 дня (или возвращается из него).
 * Игрок подтверждает конкретный минт и вид перка — подменённый ответ бэкенда
 * не может увести в vault другой NFT.
 */
export type CollectorIntent =
  | { readonly kind: "collector"; readonly action: "stake"; readonly user: string; readonly mint: string; readonly collectorKind: "historian" | "medallion" }
  | { readonly kind: "collector"; readonly action: "unstake"; readonly user: string; readonly mint: string };
/**
 * Книга заявок v2: цена за ЦЕЛЫЙ ресурс, эскроу считает сама программа. Кошелёк
 * сверяет и заявку, и посчитанный эскроу, поэтому подменённый ответ бэкенда не
 * может ни увести в залог другую сумму, ни свести чужую пару.
 */
export type OrderbookV2Intent =
  | { readonly kind: "orderbookV2"; readonly action: "buy"; readonly user: string; readonly mint: string; readonly resourceKind: number; readonly priceLamportsPerWhole: string; readonly amountAtoms: string; readonly escrowLamports: string }
  | { readonly kind: "orderbookV2"; readonly action: "sell"; readonly user: string; readonly mint: string; readonly resourceKind: number; readonly priceLamportsPerWhole: string; readonly amountAtoms: string }
  | { readonly kind: "orderbookV2"; readonly action: "cancelBuy"; readonly user: string; readonly mint: string }
  | { readonly kind: "orderbookV2"; readonly action: "cancelSell"; readonly user: string; readonly mint: string }
  | { readonly kind: "orderbookV2"; readonly action: "match"; readonly user: string; readonly mint: string; readonly buyMaker: string; readonly sellMaker: string; readonly treasury: string };

/**
 * [§3.4] Перерождение. Кошелёк подписывает ровно две инструкции в одной
 * транзакции: полный сброс в aof-core и запись ребёрта в aof-rebirth. Список
 * сжигаемых излишков входит в интент, поэтому подменённый ответ бэкенда не
 * может ни сжечь чужие аккаунты, ни оставить часть склада при сбросе.
 */
export interface RebirthIntent {
  readonly kind: "rebirth";
  readonly user: string;
  readonly seasonId: number;
  readonly costLamports: string;
  readonly treasury: string;
  readonly surplus: readonly { readonly mint: string; readonly tokenAccount: string; readonly amountAtoms: string }[];
}

export type TransactionIntent = MarketplaceBuyIntent | PackOpenIntent | SeasonPassIntent | LotteryTicketIntent | GasTankIntent | CollectorIntent | OrderbookV2Intent | RebirthIntent;
export const PACK_OPEN_COMMIT_DISCRIMINATOR = [119, 24, 174, 81, 188, 146, 76, 40] as const;

/** Signatures a transaction for `intent` may carry: the wallet, plus the
 * operator's co-signature for co-signed game commits. */
export function expectedSigners(intent: TransactionIntent | undefined): number {
  // packOpen и rebirth co-sign-ятся оператором: без его подписи транзакция не
  // собирается, поэтому кошелёк разрешает вторую подпись.
  return intent?.kind === "packOpen" || intent?.kind === "rebirth" ? 2 : 1;
}
type Instruction = { programId: string; keys: PublicKey[]; data: Uint8Array };

export function isMarketplaceBuy(ix: Instruction): boolean {
  return ix.programId === CORE_PROGRAM_ID && MARKETPLACE_BUY_DISCRIMINATOR.every((v, i) => ix.data[i] === v);
}
const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync(
  [new TextEncoder().encode(seed), ...(key ? [key.toBytes()] : [])], new PublicKey(CORE_PROGRAM_ID),
)[0];
const ata = (mint: PublicKey, owner: PublicKey) => PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0];
function keysEqual(actual: PublicKey[], expected: PublicKey[]): boolean {
  return actual.length === expected.length && expected.every((key, i) => key.equals(actual[i]));
}

/**
 * [AUDIT F-32] Generic aof-core instruction policy, applied to every
 * transaction the player is asked to sign.
 *
 * Before this, only `marketplace_buy` was checked; every other instruction was
 * accepted on the strength of the program allowlist alone, so a tampered (or
 * compromised) backend could swap the discriminator, append an instruction, or
 * move the player into the counterparty's account slot.
 */
export function validateCoreInstructions(instructions: Instruction[], user: PublicKey): void {
  for (const ix of instructions) {
    const spec = coreInstructionSpec(ix.programId, ix.data, CORE_PROGRAM_ID);
    if (!spec) continue; // not an aof-core call: txGuard's program policy covers it
    if (spec.authorityOnly) {
      throw new Error(`Authority-only instruction ${spec.name} cannot be signed by a player wallet`);
    }
    // `trailingAccounts: "pairs"` (reset_for_rebirth) — единственный случай,
    // когда программа читает `ctx.remaining_accounts`. Их состав не описывает
    // IDL, поэтому здесь проверяется только форма: пары после фиксированного
    // префикса. Что именно за пары — знает валидатор намерения перерождения.
    const allowedExtra = spec.trailingAccounts === "pairs" ? ix.keys.length - spec.accounts.length : 0;
    if (allowedExtra < 0 || allowedExtra % 2 !== 0 || (allowedExtra === 0 && ix.keys.length !== spec.accounts.length)) {
      throw new Error(`Unexpected account count for ${spec.name}`);
    }
    // Every party slot the program requires a signature from must be the
    // connected wallet. Non-signer party slots (the payee of an auction settle,
    // the two makers of an order match) are left alone: those instructions are
    // permissionless and may be cranked by anyone.
    for (const index of spec.actorIndexes) {
      if (!spec.signerIndexes.includes(index)) continue;
      if (!ix.keys[index]?.equals(user)) {
        throw new Error(`Wallet is not the ${spec.accounts[index]} of ${spec.name}`);
      }
    }
  }
}

/** Locally constructed intent, never a response-provided "approved" object.
 * Exact asset, parties, destinations and bytes are checked; any extra action
 * (even through an allowed AOF program) fails before the wallet sees it. */
export function validateTransactionIntent(
  instructions: Instruction[], intent: TransactionIntent | undefined, user: PublicKey,
  now = Math.floor(Date.now() / 1000),
): void {
  if (instructions.some((ix) => ix.programId === CORE_PROGRAM_ID &&
      [92, 247, 50, 140, 72, 120, 69, 249].every((byte, i) => ix.data[i] === byte))) {
    throw new Error("Unbounded legacy marketplace purchase is disabled");
  }
  // [AUDIT F-32] Full intent validation exists only for marketplace_buy today,
  // but every aof-core instruction can now at least be *named*. Four checks run
  // for every transaction, with or without an intent object:
  validateCoreInstructions(instructions, user);

  if (!intent) {
    if (instructions.some(isMarketplaceBuy)) throw new Error("Marketplace purchase requires a local user intent");
    return; // Other operations still use the existing guard policy, not full intent validation.
  }
  if (intent.kind === "packOpen") return validatePackOpenIntent(instructions, intent, user);
  if (intent.kind === "seasonPass") return validateSeasonPassIntent(instructions, intent, user);
  if (intent.kind === "lotteryTicket") return validateLotteryTicketIntent(instructions, intent, user);
  if (intent.kind === "gasTank") return validateGasTankIntent(instructions, intent, user);
  if (intent.kind === "collector") return validateCollectorIntent(instructions, intent, user);
  if (intent.kind === "orderbookV2") return validateOrderbookV2Intent(instructions, intent, user);
  if (intent.kind === "rebirth") return validateRebirthIntent(instructions, intent, user);
  if (intent.kind !== "marketplaceBuy") throw new Error("Unsupported transaction intent");
  positiveU64(intent.maxPriceLamports);
  if (!/^[1-9][0-9]{0,15}$/.test(intent.expiresAt) || !Number.isSafeInteger(Number(intent.expiresAt)) ||
      Number(intent.expiresAt) <= now || Number(intent.expiresAt) - now > 300) throw new Error("Quote expired");
  const buyer = new PublicKey(intent.buyer), mint = new PublicKey(intent.mint);
  if (!buyer.equals(user)) throw new Error("Wallet differs from purchase intent");
  const listing = pda("listing", mint), buyerToken = ata(mint, buyer);
  const expected = [pda("config"), buyer, new PublicKey(intent.seller), new PublicKey(intent.treasury),
    mint, pda("tool", mint), listing, ata(mint, listing), buyerToken, TOKEN, new PublicKey(SYSTEM)];
  let buys = 0, atas = 0;
  for (const ix of instructions) {
    if (isMarketplaceBuy(ix)) {
      if (++buys !== 1 || !keysEqual(ix.keys, expected) || ix.data.length !== 24) throw new Error("Unexpected purchase accounts or instructions");
      const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
      if (view.getBigUint64(8, true) !== BigInt(intent.maxPriceLamports) || view.getBigInt64(16, true) !== BigInt(intent.expiresAt)) {
        throw new Error("Transaction price or deadline differs from user intent");
      }
    } else if (ix.programId === ATA.toBase58()) {
      if (++atas !== 1 || ix.data.length !== 1 || ix.data[0] !== 1 ||
          !keysEqual(ix.keys, [buyer, buyerToken, buyer, mint, new PublicKey(SYSTEM), TOKEN])) throw new Error("Unexpected rent destination");
    } else if (ix.programId !== COMPUTE) {
      throw new Error("Extra instruction is outside the purchase intent");
    }
  }
  if (buys !== 1) throw new Error("Missing marketplace purchase");
}

function validateLotteryTicketIntent(instructions: Instruction[], intent: LotteryTicketIntent, user: PublicKey): void {
  // Neither rounding through Number nor trusting a backend-provided PDA can
  // change the ticket the player agreed to claim/refund.
  const u64Bytes = (value: string, allowZero: boolean) => {
    if (typeof value !== 'string' || !(allowZero ? /^(0|[1-9][0-9]{0,19})$/ : /^[1-9][0-9]{0,19}$/).test(value) ||
        BigInt(value) > (1n << 64n) - 1n) throw new Error('Invalid lottery ticket number');
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
    return bytes;
  };
  const roundBytes = u64Bytes(intent.roundId, true);
  const ticketBytes = u64Bytes(intent.ticketNumber, true);
  if (!new PublicKey(intent.user).equals(user)) throw new Error('Wallet differs from the lottery intent');
  const seeded = (seed: string, ...parts: Uint8Array[]) => PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), ...parts], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  const ix = instructions[0];
  const spec = ix && coreInstructionSpec(ix.programId, ix.data, CORE_PROGRAM_ID);
  if (intent.action === 'buy') {
    // Data layout: 8-byte discriminator + u64 max_price_lamports (LE).
    positiveU64(intent.maxPriceLamports);
    const counterBytes = new TextEncoder().encode('count');
    const expected = [pda('config'), user, seeded('lottery_round', roundBytes),
      seeded('lottery_ticket', roundBytes, ticketBytes),
      seeded('lottery_ticket', counterBytes, roundBytes, user.toBytes()),
      new PublicKey(SYSTEM)];
    if (instructions.length !== 1 || spec?.name !== 'buy_lottery_ticket' || ix.data.length !== 16 ||
        !keysEqual(ix.keys, expected)) {
      throw new Error('Lottery purchase differs from the verified round and wallet');
    }
    const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
    if (view.getBigUint64(8, true) !== BigInt(intent.maxPriceLamports)) {
      throw new Error('Lottery price ceiling differs from user intent');
    }
    return;
  }
  const expectedName = intent.action === 'claim' ? 'claim_lottery_prize'
    : intent.action === 'refund' ? 'refund_lottery_ticket' : null;
  if (!expectedName || instructions.length !== 1 || spec?.name !== expectedName || ix.data.length !== 8 ||
      !keysEqual(ix.keys, [pda('config'), seeded('lottery_round', roundBytes),
        seeded('lottery_ticket', roundBytes, ticketBytes), user])) {
    throw new Error('Lottery transaction differs from the verified ticket');
  }
}

const ATOMS_PER_RESOURCE = 1_000_000_000n;
const quoteTotal = (pricePerWhole: bigint, atoms: bigint) => (pricePerWhole * atoms + ATOMS_PER_RESOURCE - 1n) / ATOMS_PER_RESOURCE;
const takerBuffer = (total: bigint) => (total * 40n + 9_999n) / 10_000n;

/**
 * [§3.4] Перерождение: ровно две инструкции — `reset_for_rebirth` в aof-core и
 * `do_rebirth` в aof-rebirth — с точными аккаунтами и полным списком излишков.
 * Любая третья инструкция, другой порядок, другой набор `(mint, token_account)`
 * или другой размер данных отменяют подпись.
 */
function validateRebirthIntent(instructions: Instruction[], intent: RebirthIntent, user: PublicKey): void {
  if (instructions.length !== 2) throw new Error("Rebirth must be exactly two instructions");
  const me = new PublicKey(intent.user);
  if (!me.equals(user)) throw new Error("Wallet differs from the rebirth intent");
  if (!Number.isSafeInteger(intent.seasonId) || intent.seasonId < 0 || intent.seasonId > 0xffffffff) {
    throw new Error("Invalid rebirth season");
  }
  positiveU64(intent.costLamports);
  if (!Array.isArray(intent.surplus) || intent.surplus.length > 16) throw new Error("Invalid rebirth surplus list");

  if (instructions[0].programId !== CORE_PROGRAM_ID || instructions[1].programId !== REBIRTH_PROGRAM_ID) {
    throw new Error("Rebirth must stay inside the two game programs");
  }
  const resetSpec = coreInstructionSpec(instructions[0].programId, instructions[0].data, CORE_PROGRAM_ID);
  if (resetSpec?.name !== "reset_for_rebirth") throw new Error("Missing full-reset instruction");
  const rebirthData = instructions[1].data;
  if (rebirthData.length < 8 ||
      !REBIRTH_DO_DISCRIMINATOR.every((byte, index) => rebirthData[index] === byte)) {
    throw new Error("Missing rebirth instruction");
  }

  const u32 = new Uint8Array(4);
  new DataView(u32.buffer).setUint32(0, intent.seasonId, true);
  const seasonAddress = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("season"), u32], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  const seasonPassAddress = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("season_pass"), me.toBytes(), u32], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  const expectedKeys = [
    pda("config"),
    new PublicKey(instructions[0].keys[1]), // operator: подписывает бэкенд, конкретный ключ проверяет ядро
    me,
    pda("player", me),
    seasonAddress,
    seasonPassAddress,
    pda("material_mints"),
    TOKEN,
  ];
  // Сравнивается фиксированный префикс: за ним идут пары излишков, их
  // проверка — ниже, позиционно.
  if (!keysEqual(instructions[0].keys.slice(0, expectedKeys.length), expectedKeys)) {
    throw new Error("Unexpected full-reset accounts");
  }
  if (instructions[0].data.length !== 12) throw new Error("Unexpected full-reset payload");
  const seasonView = new DataView(instructions[0].data.buffer, instructions[0].data.byteOffset, 12);
  if (seasonView.getUint32(8, true) !== intent.seasonId) throw new Error("Season differs from the rebirth intent");

  // Список сжигаемых аккаунтов сверяется позиционно: тот же порядок, те же
  // минты и токен-аккаунты, что показаны игроку.
  if (instructions[0].keys.length !== expectedKeys.length + intent.surplus.length * 2) {
    throw new Error("Rebirth surplus list does not match the transaction");
  }
  intent.surplus.forEach((entry, index) => {
    const mint = new PublicKey(entry.mint);
    const token = new PublicKey(entry.tokenAccount);
    positiveU64(entry.amountAtoms);
    const actualMint = instructions[0].keys[expectedKeys.length + index * 2];
    const actualToken = instructions[0].keys[expectedKeys.length + index * 2 + 1];
    if (!mint.equals(actualMint) || !token.equals(actualToken)) throw new Error("Rebirth burns an unexpected account");
    if (!ata(mint, me).equals(token)) throw new Error("Rebirth burns a non-canonical token account");
  });

  const rebirthConfig = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("rebirth_config")], new PublicKey(REBIRTH_PROGRAM_ID),
  )[0];
  const rebirthRecord = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("rebirth_record"), me.toBytes()], new PublicKey(REBIRTH_PROGRAM_ID),
  )[0];
  const expectedRebirthKeys = [
    rebirthConfig,
    new PublicKey(instructions[1].keys[1]), // authority: подпись бэкенда
    rebirthRecord,
    me,
    new PublicKey(intent.treasury),
    new PublicKey(SYSTEM),
  ];
  if (!keysEqual(instructions[1].keys, expectedRebirthKeys)) throw new Error("Unexpected rebirth accounts");
  if (instructions[1].data.length !== 8) throw new Error("Unexpected rebirth payload");
}

function validateOrderbookV2Intent(instructions: Instruction[], intent: OrderbookV2Intent, user: PublicKey): void {
  const mint = new PublicKey(intent.mint);
  const seedsOf = (...parts: (string | Uint8Array)[]) => parts.map((part) =>
    typeof part === "string" ? new TextEncoder().encode(part) : part);
  const orderPda = (maker: PublicKey) => PublicKey.findProgramAddressSync(
    seedsOf("resource_order_v2", maker.toBytes(), mint.toBytes()), new PublicKey(CORE_PROGRAM_ID))[0];
  if (!new PublicKey(intent.user).equals(user)) throw new Error("Wallet differs from the order intent");
  if (instructions.length !== 1) throw new Error("Order operation must be a single instruction");
  const ix = instructions[0];
  const spec = ix && coreInstructionSpec(ix.programId, ix.data, CORE_PROGRAM_ID);
  const order = orderPda(user);
  const materialMints = pda("material_mints");
  const u64 = (value: unknown, field: string): bigint => {
    if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value) || BigInt(value) > (1n << 64n) - 1n) {
      throw new Error(`${field} must be a positive u64`);
    }
    return BigInt(value);
  };

  if (intent.action === "buy") {
    const price = u64(intent.priceLamportsPerWhole, "priceLamportsPerWhole");
    const atoms = u64(intent.amountAtoms, "amountAtoms");
    const escrow = u64(intent.escrowLamports, "escrowLamports");
    // Программа спишет ровно это; расхождение — отказ до открытия кошелька.
    const expected = quoteTotal(price, atoms) + takerBuffer(quoteTotal(price, atoms));
    if (expected !== escrow) throw new Error("Order escrow differs from the verified quote");
    if (!Number.isInteger(intent.resourceKind) || intent.resourceKind < 0 || intent.resourceKind > 26) throw new Error("Invalid resource kind");
    if (spec?.name !== "place_buy_order_v2" || ix.data.length !== 25 ||
        !keysEqual(ix.keys, [pda("config"), user, mint, materialMints, order, new PublicKey(SYSTEM)])) {
      throw new Error("Unknown buy order layout");
    }
    const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
    if (ix.data[8] !== intent.resourceKind || view.getBigUint64(9, true) !== price || view.getBigUint64(17, true) !== atoms) {
      throw new Error("Order terms differ from user intent");
    }
    return;
  }

  if (intent.action === "sell") {
    const price = u64(intent.priceLamportsPerWhole, "priceLamportsPerWhole");
    const atoms = u64(intent.amountAtoms, "amountAtoms");
    if (!Number.isInteger(intent.resourceKind) || intent.resourceKind < 0 || intent.resourceKind > 26) throw new Error("Invalid resource kind");
    // Vault — канонический ATA самого PDA заявки: иначе токены уйдут не туда.
    const vault = PublicKey.findProgramAddressSync([order.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0];
    if (spec?.name !== "place_sell_order_v2" || ix.data.length !== 25 ||
        !keysEqual(ix.keys, [pda("config"), user, mint, materialMints, ata(mint, user), order, vault,
          TOKEN, new PublicKey(SYSTEM)])) {
      throw new Error("Unknown sell order layout");
    }
    const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
    if (ix.data[8] !== intent.resourceKind || view.getBigUint64(9, true) !== price || view.getBigUint64(17, true) !== atoms) {
      throw new Error("Order terms differ from user intent");
    }
    return;
  }

  if (intent.action === "cancelBuy" || intent.action === "cancelSell") {
    const expectedName = intent.action === "cancelBuy" ? "cancel_buy_order_v2" : "cancel_sell_order_v2";
    const keys = intent.action === "cancelBuy"
      ? [pda("config"), user, mint, order]
      : [pda("config"), user, mint, order,
        PublicKey.findProgramAddressSync([order.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0],
        ata(mint, user), TOKEN];
    if (spec?.name !== expectedName || ix.data.length !== 8 || !keysEqual(ix.keys, keys)) {
      throw new Error("Cancellation differs from the verified order");
    }
    return;
  }

  const buyMaker = new PublicKey(intent.buyMaker);
  const sellMaker = new PublicKey(intent.sellMaker);
  const buyOrder = orderPda(buyMaker), sellOrder = orderPda(sellMaker);
  if (spec?.name !== "match_resource_orders_v2" || ix.data.length !== 8 ||
      !keysEqual(ix.keys, [pda("config"), materialMints, mint, buyOrder, sellOrder, sellMaker,
        new PublicKey(intent.treasury),
        PublicKey.findProgramAddressSync([sellOrder.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0],
        ata(mint, buyMaker), TOKEN])) {
    throw new Error("Match differs from the verified pair");
  }
}

function validateCollectorIntent(instructions: Instruction[], intent: CollectorIntent, user: PublicKey): void {
  // Ставка уводит NFT в vault PDA на 3 дня, снятие возвращает его и списывает
  // 0.01 SOL из газ-бака. Кошелёк подписывает только тот минт и тот вид перка,
  // которые игрок видел на экране.
  const mint = new PublicKey(intent.mint);
  const [collector] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("collector"), mint.toBytes()], new PublicKey(CORE_PROGRAM_ID));
  const [collectorAllow] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("collector_allow"), mint.toBytes()], new PublicKey(CORE_PROGRAM_ID));
  const [vault] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("vault")], new PublicKey(CORE_PROGRAM_ID));
  const userToken = ata(mint, user);
  const vaultToken = PublicKey.findProgramAddressSync([vault.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA)[0];
  const expectedName = intent.action === "stake" ? "collector_stake" : "collector_unstake";
  const expectedData = intent.action === "stake" ? 9 : 8;
  if (!new PublicKey(intent.user).equals(user)) throw new Error("Wallet differs from the collector intent");
  if (instructions.length !== 1) throw new Error("Collector operation must be a single instruction");
  const ix = instructions[0];
  const spec = ix && coreInstructionSpec(ix.programId, ix.data, CORE_PROGRAM_ID);
  if (spec?.name !== expectedName || ix.data.length !== expectedData) throw new Error("Unexpected collector instruction");
  const keys = intent.action === "stake"
    ? [pda("config"), user, mint, userToken, vault, vaultToken, collector, collectorAllow, pda("player", user), TOKEN, new PublicKey(SYSTEM)]
    : [pda("config"), user, mint, userToken, vault, vaultToken, collector, pda("player", user), pda("gastank", user), TOKEN];
  if (!keysEqual(ix.keys, keys)) throw new Error("Unexpected collector accounts");
  if (intent.action === "stake") {
    // Borsh-вариант CollectorKind: 0 = Historian, 1 = Medallion.
    const expected = intent.collectorKind === "historian" ? 0 : 1;
    if (ix.data[8] !== expected) throw new Error("Collector kind differs from user intent");
  }
}

function validateGasTankIntent(instructions: Instruction[], intent: GasTankIntent, user: PublicKey): void {
  // Сумма в контракте одна и та же (u64), но её единица зависит от действия:
  // депозит — лампорты, вывод — микро. Проверяем и имя инструкции, и адреса, и
  // само число: подписываем ровно то, что игрок видел на экране.
  const expectedName = intent.action === "deposit" ? "deposit_gas" : "withdraw_gas";
  const expectedAmount = positiveU64(intent.action === "deposit" ? intent.amountLamports : intent.amountMicros);
  if (!new PublicKey(intent.user).equals(user)) throw new Error("Wallet differs from the gas tank intent");
  if (instructions.length !== 1) throw new Error("Gas tank operation must be a single instruction");
  const ix = instructions[0];
  const spec = ix && coreInstructionSpec(ix.programId, ix.data, CORE_PROGRAM_ID);
  if (spec?.name !== expectedName || ix.data.length !== 16) throw new Error("Unexpected gas tank instruction");
  if (!keysEqual(ix.keys, [pda("config"), user, pda("gastank", user), new PublicKey(SYSTEM)])) {
    throw new Error("Unexpected gas tank accounts");
  }
  const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
  if (view.getBigUint64(8, true) !== BigInt(expectedAmount)) throw new Error("Gas tank amount differs from user intent");
}

function validateSeasonPassIntent(instructions: Instruction[], intent: SeasonPassIntent, user: PublicKey): void {
  if (intent.priceLamports !== '150000000' || !Number.isInteger(intent.seasonId) ||
      intent.seasonId < 0 || intent.seasonId > 0xffffffff ||
      !new PublicKey(intent.user).equals(user)) throw new Error('Invalid season pass purchase intent');
  const seasonSeed = new Uint8Array(4);
  new DataView(seasonSeed.buffer).setUint32(0, intent.seasonId, true);
  const seeded = (seed: string, ...parts: Uint8Array[]) => PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), ...parts], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  // Find the discriminator in the generated program table via the known Anchor
  // instruction name, not a second handwritten byte sequence.
  const ix = instructions[0];
  const purchase = ix && coreInstructionSpec(ix.programId, ix.data, CORE_PROGRAM_ID);
  if (instructions.length !== 1 || purchase?.name !== 'purchase_season_pass' ||
      ix.data.length !== 8 || !keysEqual(ix.keys, [
        pda('config'), user, new PublicKey(intent.treasury),
        seeded('season', seasonSeed), seeded('season_pass', user.toBytes(), seasonSeed),
        new PublicKey(SYSTEM),
      ])) throw new Error('Unexpected season pass transaction');
}

function validatePackOpenIntent(instructions: Instruction[], intent: PackOpenIntent, user: PublicKey): void {
  positiveU64(intent.maxPriceLamports);
  if (!new PublicKey(intent.user).equals(user)) throw new Error("Wallet differs from the pack intent");
  if (!Number.isInteger(intent.packType) || intent.packType < 0 || intent.packType > 2) throw new Error("Unknown pack type");
  let commits = 0;
  for (const ix of instructions) {
    const isCommit = ix.programId === CORE_PROGRAM_ID && PACK_OPEN_COMMIT_DISCRIMINATOR.every((v, i) => ix.data[i] === v);
    if (isCommit) {
      // disc(8) | pack_type u8 | nonce u64 | max_price_lamports u64
      if (++commits !== 1 || ix.data.length !== 25 || !ix.keys[2]?.equals(user)) throw new Error("Unexpected pack commit accounts or data");
      if (ix.data[8] !== intent.packType) throw new Error("Pack type differs from user intent");
      const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
      if (view.getBigUint64(17, true) !== BigInt(intent.maxPriceLamports)) throw new Error("Pack price ceiling differs from user intent");
    } else if (ix.programId !== COMPUTE) {
      throw new Error("Extra instruction is outside the pack intent");
    }
  }
  if (commits !== 1) throw new Error("Missing pack commit");
}
