/**
 * Price-Cranker: кипер хот-маркета.
 * Периодически вызывает hot_market_crank для каждой редкости:
 *   - обновляет кэш цен по актуальной формуле VRGDA
 *   - контракт сам сбрасывает purchases_in_window, если окно (>1ч) прошло
 * Без кипера цена "застревает" на пике после всплеска покупок, а рост
 * от покупок в окне не затухает — рынок не остывает.
 *
 * Запуск: npx ts-node services/price-cranker/index.ts
 * Интервал: CRANK_INTERVAL_MS из окружения, по умолчанию 5 мин (прод) / 30с (локал).
 */
import { marketProgram } from "../../src/provider";
import { hotMarketPoolPda } from "../../src/lib/pda";
import { authorityOnly } from "../../src/lib/tx";
import { AUTHORITY } from "../../src/config";

const CRANK_INTERVAL_MS = Number(process.env.CRANK_INTERVAL_MS) > 0
  ? Number(process.env.CRANK_INTERVAL_MS)
  : process.env.NODE_ENV === "production"
    ? 5 * 60 * 1000   // 5 минут в проде
    : 30 * 1000;      // 30 секунд локально

// Редкости пулов хот-маркета (1..4 по MarketError::InvalidRarity)
const RARITIES = [1, 2, 3, 4];

async function crankRarity(rarity: number): Promise<void> {
  // [AUDIT AOF-H1] Fail-closed: crank подписывает authority; в read-only
  // режиме поднимаем ошибку до сборки транзакции (guard сужает тип Keypair).
  if (!AUTHORITY) {
    throw new Error(
      "Authority signing is disabled (AUTHORITY_MODE=read-only). " +
      "Wire Squads/KMS or run with AUTHORITY_MODE=hot [AOF-H1].",
    );
  }
  try {
    const [pool] = hotMarketPoolPda(rarity);

    // Пул мог быть не инициализирован — пропускаем без ошибки
    try {
      await (marketProgram.account as any)["hotMarketPool"].fetch(pool);
    } catch {
      console.log(`[price-cranker] rarity ${rarity}: пул не инициализирован, пропуск`);
      return;
    }

    const ix = await (marketProgram.methods as any)
      .hotMarketCrank(rarity)
      .accounts({
        pool,
        caller: AUTHORITY.publicKey,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    console.log(`[price-cranker] rarity ${rarity}: cranked, sig=${sig}`);
  } catch (e: any) {
    console.error(`[price-cranker] rarity ${rarity}: ошибка`, e.message);
  }
}

async function crankAll(): Promise<void> {
  console.log(`[price-cranker] Цикл начат (${new Date().toISOString()})`);
  for (const rarity of RARITIES) {
    await crankRarity(rarity);
  }
}

async function main() {
  console.log(`[price-cranker] Запуск, интервал ${CRANK_INTERVAL_MS}мс`);
  await crankAll();
  setInterval(crankAll, CRANK_INTERVAL_MS);
}

main().catch(console.error);
