# NFT cards — «Robotic Harvest Arm / Automated Collector»

Готовый набор карточек-предметов (5 редкостей) для проекта: **PNG-32 с полностью
прозрачным фоном** — сгенерирован только сам объект карточки, никакого внешнего
фона, интерьер/подсветка остаются внутри рамки (как в референсах).

| Файл | Редкость | Rarity id (on-chain) | Акцент |
|------|----------|----------------------|--------|
| `common.png`    | Common    | `0` | `#9FE8F5` |
| `uncommon.png`  | Uncommon  | `1` | `#3DFF7A` |
| `rare.png`      | Rare      | `2` | `#3FA9FF` |
| `epic.png`      | Epic      | `3` | `#FF3DD1` |
| `legendary.png` | Legendary | `4` | `#FFC030` |

`rarityId` совпадает с `Rarity::index()` из `aof-core/src/state.rs`
(Common = 0 … Legendary = 4), так что ассет можно выбирать напрямую по
on-chain значению.

## Что внутри

```
frontend/public/nft/cards/
├── manifest.json          # описание набора (canvas, акценты, пути)
├── common.png …           # 759×1332, RGBA, прозрачный фон (полный размер)
└── webp/<key>@512.webp    # 292×512 lossless-превью для гридов инвентаря
```

* Все карточки приведены к **одному холсту 759×1332** и отцентрованы — в сетке
  инвентаря они выстраиваются ровно, без «прыжков» по высоте.
* Размер рассчитан на карточку ~520 CSS px по ширине (ретина ×2).
* Фон удалён матированием края (`alpha = ‹obs − B, F − B› / ‹F − B, F − B›`) с
  un-mix фона из полупрозрачной кромки, поэтому нет чёрной/белой каймы ни на
  тёмной, ни на светлой теме UI.
* Микро-детализация поднята мягким unsharp mask (55 % / r1.2) — без гало.

## Использование во фронтенде

```tsx
import { nftCardSrc, preloadNftCards } from "../lib/nftCards";

// полный PNG (прозрачный) или 512 px WebP для грида
<img src={nftCardSrc("legendary")} alt="Legendary" />
<img src={nftCardSrc("legendary", { thumb: true })} alt="Legendary" />

preloadNftCards();            // прогреть кэш всех 5 карточек
```

`ToolMiningCard.tsx` уже показывает карточку через `getToolNftCard(toolType, rarity)`
из `frontend/src/lib/toolMeta.ts` — эта функция отдаёт нужный PNG по редкости
(`/nft/cards/<rarity>.png`) и совместима с on-chain `rarity` (строка или
`{ uncommon: {} }`).

## Как перегенерировать

1. Положить сырые рендеры (карточка на однотонном фоне) в папку `raw/`:

   ```
   raw/common_raw.png  raw/uncommon_raw.png  raw/rare_raw.png
   raw/epic_raw.png    raw/legendary_raw.png
   ```

2. Собрать ассеты (нужны `pillow`, `numpy`, `scipy`):

   ```bash
   python3 scripts/nft-cards/make_cards.py --raw ./raw --out frontend/public/nft/cards
   ```

Скрипт сам определит фон по кромке (поддерживаются и чёрный «войд», и белый
бэкдроп), вырежет силуэт, сохранит всю внутреннюю гравировку, соберёт PNG-32,
WebP-превью и `manifest.json`.

## Текст на карточках

Надписи «ROBOTIC HARVEST ARM», «AUTOMATED COLLECTOR» и название редкости
**запечены внутрь арта**, как в референсах. Если для i18n/динамических имён
нужен вариант без текста — скажите, сделаю отдельную серию «пустых» карточек
(подписи тогда рисует UI поверх).
