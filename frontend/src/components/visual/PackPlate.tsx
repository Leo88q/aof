import { ArtPlate } from "./ArtPlate";
import { PACK_ART } from "../../lib/visualAssets";

/**
 * Витрина капсулы дропа [F-06].
 *
 * Раньше на экране капсул стояли только строка цены и кнопка «Открыть» —
 * ни картинки, ни объяснения, что за капсула; при нажатии открывалась
 * анимация тряски одной и той же иконки. Теперь у каждого размера своя
 * плитка, у закрытой и открытой витрины — разные состояния, а подпись
 * объясняет разницу между размерами.
 *
 * Плитка не выдаёт результат: что выпало, считает программа из хеша слота. Поэтому
 * открытая картинка одинакова для всех размеров и пуста внутри.
 */
export function PackPlate({
  packId,
  state = "sealed",
  size = 96,
  alt = "",
  className = "",
}: {
  packId: "small" | "medium" | "big";
  /** sealed — закрытая витрина размера, opened — открытая (пустая). */
  state?: "sealed" | "opened";
  size?: number | string;
  alt?: string;
  className?: string;
}) {
  const src = state === "opened" ? PACK_ART.opened : PACK_ART[packId];
  return <ArtPlate src={src} alt={alt} size={size} className={`nf-plate--pack ${className}`.trim()} />;
}
