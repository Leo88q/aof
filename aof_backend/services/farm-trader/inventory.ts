/**
 * [ФИКС Группы 3] Резолв инвентаря пользователя для авто-продажи.
 * Читает ончейн-инструменты юзера (aof-core ToolData) и подбирает
 * подходящий по редкости для исполнения правила smart_sell.
 *
 * Раскладка ToolData: discriminator(8) + mint(32) + owner(32) + ...
 * => поле owner начинается с абсолютного оффсета 40.
 */
import { program } from "../../src/provider";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const TOOL_OWNER_OFFSET = 40;

// Нормализуем декодированную редкость (число | строка | {variant:{}}) к индексу
function rarityToIndex(r: any): number {
  if (typeof r === "number") return r;
  if (typeof r === "string") return RARITY_ORDER.indexOf(r.toLowerCase());
  if (r && typeof r === "object") {
    const keys = Object.keys(r);
    if (keys.length > 0) return RARITY_ORDER.indexOf(keys[0].toLowerCase());
  }
  return -1;
}

export interface ResolvedTool {
  mint: string;
  rarity: number;
}

/**
 * Подобрать инструмент юзера нужной редкости, который можно продать:
 * не в майнинге, не в стейке, не сдан в аренду (operator == owner).
 * Возвращает null если подходящего нет.
 */
export async function getUserToolForRarity(
  user: string,
  rarity: number
): Promise<ResolvedTool | null> {
  try {
    const tools: any[] = await (program.account as any)["toolData"].all([
      { memcmp: { offset: TOOL_OWNER_OFFSET, bytes: user } },
    ]);

    for (const t of tools) {
      const acc = t.account;
      if (rarityToIndex(acc.rarity) !== rarity) continue;
      if (acc.isMining) continue;
      if (acc.staked) continue;
      // Не продаём сданный в аренду инструмент (оператор != владелец)
      if (
        acc.operator &&
        acc.owner &&
        acc.operator.toBase58() !== acc.owner.toBase58()
      ) {
        continue;
      }
      return { mint: acc.mint.toBase58(), rarity };
    }
    return null;
  } catch (e: any) {
    console.error("[farm-trader] inventory resolve error:", e.message);
    return null;
  }
}
