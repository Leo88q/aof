#!/usr/bin/env bash
# Вырезаем иконки из тёмного фона → прозрачный PNG.
#
# Исходники сгенерированы на почти однородном тёмно-синем фоне. В игре
# иконки лежат на панелях другого оттенка, и «чёрный квадрат» вокруг каждой
# иконки бросается в глаза. Скрипт строит альфа-канал по расстоянию цвета
# до фона, заливает внутренние «дыры» объекта (тёмные детали внутри
# контура остаются непрозрачными), оставляет полупрозрачное свечение и
# сохраняет <name>.png рядом с исходником (исходный .jpg удаляется, если
# не задано KEEP_JPG=1).
#
# Использование:
#   bash scripts/assets/cutout-icons.sh                 # icons/ и icons/ui/
#   bash scripts/assets/cutout-icons.sh path/a.jpg …    # отдельные файлы
#   OUT_DIR=/tmp/preview bash scripts/assets/cutout-icons.sh   # не трогать исходники
#
# Параметры (env):
#   HARD=9      порог (%) «точно объект» для маски с заливкой дыр
#   SOFT_LO=3   начало рампы полупрозрачности (%), свечения/ореолы
#   SOFT_HI=16  конец рампы (%): дальше — полностью непрозрачно
#   FEATHER=0.6 размытие края маски, px
#   OPEN=0      радиус морфологического Open (px) для шумных фонов: убирает
#               звёзды/зерно перед заливкой дыр (для «звёздных» иконок: OPEN=2
#               вместе с HARD=18 SOFT_LO=12 SOFT_HI=32)
#   MAX_SIDE=512 максимальная сторона результата (апскейла нет)
#   COLORS=255  палитра PNG (0 — без квантования; 255 даёт файл в 3–4 раза меньше)
#
# Требуется ImageMagick (convert/identify).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ASSETS="$ROOT/public/assets"
HARD="${HARD:-9}"
SOFT_LO="${SOFT_LO:-3}"
SOFT_HI="${SOFT_HI:-16}"
FEATHER="${FEATHER:-0.6}"
OPEN="${OPEN:-0}"
MAX_SIDE="${MAX_SIDE:-512}"
COLORS="${COLORS:-255}"
OUT_DIR="${OUT_DIR:-}"
KEEP_JPG="${KEEP_JPG:-0}"

command -v convert >/dev/null 2>&1 || { echo "ImageMagick (convert) не найден: brew install imagemagick"; exit 1; }

# Средний цвет фона по четырём углам (6×6 px каждый).
bg_color() {
  local f="$1"
  convert "$f" \
    \( +clone -gravity NorthWest -crop 6x6+0+0 +repage \) \
    \( +clone -gravity NorthEast -crop 6x6+0+0 +repage \) \
    \( +clone -gravity SouthWest -crop 6x6+0+0 +repage \) \
    \( +clone -gravity SouthEast -crop 6x6+0+0 +repage \) \
    -delete 0 -append -scale '1x1!' -format '%[pixel:p{0,0}]' info:
}

process() {
  local f="$1"
  local out
  if [ -n "$OUT_DIR" ]; then
    mkdir -p "$OUT_DIR"
    out="$OUT_DIR/$(basename "${f%.*}").png"
  else
    out="${f%.*}.png"
  fi
  local bg; bg="$(bg_color "$f")"
  local tmp; tmp="$(mktemp -d)"

  # 1) карта расстояния до цвета фона (0..1, максимум по каналам)
  convert "$f" \( +clone -fill "$bg" -colorize 100 \) -compose Difference -composite \
    -separate -evaluate-sequence Max -colorspace Gray "$tmp/dist.png"

  # 2) жёсткая маска объекта + заливка внутренних дыр:
  #    заливаем фон, достижимый с рамки, серым; всё остальное — объект.
  local open=()
  [ "$OPEN" != "0" ] && open=(-morphology Open "Disk:${OPEN}")
  convert "$tmp/dist.png" -threshold "${HARD}%" "${open[@]}" -morphology Close Disk:1.5 \
    -bordercolor black -border 1 -fill 'gray(50%)' -draw 'color 0,0 floodfill' -shave 1x1 \
    -fill white -opaque black -fill black -opaque 'gray(50%)' \
    -blur "0x${FEATHER}" "$tmp/hard.png"

  # 3) мягкая рампа для свечений/ореолов
  convert "$tmp/dist.png" -level "${SOFT_LO}%,${SOFT_HI}%" "$tmp/soft.png"

  # 4) альфа = max(hard, soft); применяем к исходнику
  convert "$tmp/hard.png" "$tmp/soft.png" -compose Lighten -composite "$tmp/alpha.png"
  local quant=()
  [ "$COLORS" != "0" ] && quant=(-dither FloydSteinberg -colors "$COLORS")
  convert "$f" "$tmp/alpha.png" -alpha off -compose CopyOpacity -composite \
    -resize "${MAX_SIDE}x${MAX_SIDE}>" "${quant[@]}" \
    -define png:compression-level=9 -strip "$out"
  rm -rf "$tmp"

  local W; W="$(identify -format '%w' "$out")"
  echo "cutout ${W}px bg=${bg}  $(basename "$f") -> $(basename "$out")"
  if [ -z "$OUT_DIR" ] && [ "$KEEP_JPG" != "1" ]; then rm -f "$f"; fi
}

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  while IFS= read -r f; do targets+=("$f"); done < <(
    find "$ASSETS/icons" -maxdepth 2 -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) | sort
  )
fi

n=0
for f in "${targets[@]}"; do
  process "$f"
  n=$(( n + 1 ))
done
echo "done: $n files"
