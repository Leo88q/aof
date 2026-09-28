#!/usr/bin/env bash
# Обрезка «пустых» полей у арта (иконки ресурсов, UI-иконки, NFT-плашки).
#
# Исходники сгенерированы с большим тёмным паспарту: сам объект занимает
# 25–50 % кадра, остальное — фон. В квадратных плашках (`.nf-plate`,
# `ResourceGlyph`, object-fit: contain) это выглядит как крошечная картинка
# в чёрной коробке. Скрипт находит объект по яркости, строит квадрат вокруг
# него с небольшим полем и пересохраняет файл на месте.
#
# Использование:
#   bash scripts/assets/trim-art.sh            # обработать все директории
#   DRY=1 bash scripts/assets/trim-art.sh      # только показать план
#   bash scripts/assets/trim-art.sh public/assets/icons/circuit.jpg  # один файл
#
# Параметры (env):
#   MARGIN=0.07      поле вокруг объекта (доля от размера объекта, с каждой стороны)
#   SKIP_ABOVE=0.86  если объект уже занимает больше этой доли кадра — не трогать
#   THRESH=9         порог яркости фона, % (фон ≈ 5–6 %)
#   QUALITY=90       качество JPEG
#
# Требуется ImageMagick (convert/identify). Идемпотентен: повторный запуск
# ничего не меняет (объект уже занимает > SKIP_ABOVE кадра).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ASSETS="$ROOT/public/assets"
MARGIN="${MARGIN:-0.07}"
SKIP_ABOVE="${SKIP_ABOVE:-0.86}"
THRESH="${THRESH:-9}"
QUALITY="${QUALITY:-90}"
DRY="${DRY:-0}"

command -v convert >/dev/null 2>&1 || { echo "ImageMagick (convert) не найден: brew install imagemagick"; exit 1; }

# Максимальная сторона результата по директории (апскейла нет — только даунскейл).
max_side_for() {
  case "$1" in
    */nfts/*) echo 1024 ;;
    *)        echo 512 ;;
  esac
}

# Нужен ли «мягкий» второй проход (без эрозии): для чистых иконок — да, чтобы
# не терять тонкие лучи/искры; для плашек со звёздным фоном — нет.
soft_pass_for() {
  case "$1" in
    */nfts/*) echo 0 ;;
    *)        echo 1 ;;
  esac
}

# bbox объекта: "w h x y" (пустая строка, если объект не найден)
bbox_of() { # file threshold erode(0|N) [crop-geometry]
  local f="$1" thr="$2" erode="$3" crop="${4:-}"
  local args=()
  [ -n "$crop" ] && args+=(-crop "$crop" +repage)
  args+=(-colorspace Gray -threshold "${thr}%")
  [ "$erode" != "0" ] && args+=(-morphology Erode "Disk:${erode}")
  local g
  g="$(convert "$f" "${args[@]}" -format '%@' info: 2>/dev/null || true)"
  # формат WxH+X+Y
  [[ "$g" =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]] || { echo ""; return; }
  echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]} ${BASH_REMATCH[3]} ${BASH_REMATCH[4]}"
}

process() {
  local f="$1"
  local W H
  read -r W H <<<"$(identify -format '%w %h' "$f")"
  local maxWH=$(( W > H ? W : H ))

  # 1) устойчивый bbox (эрозия убирает звёзды/шум)
  local bb; bb="$(bbox_of "$f" "$THRESH" 2)"
  if [ -z "$bb" ]; then echo "skip  (object not found)  $f"; return; fi
  local bw bh bx by; read -r bw bh bx by <<<"$bb"
  if [ "$bw" -lt 8 ] || [ "$bh" -lt 8 ]; then echo "skip  (too small $bw x $bh)  $f"; return; fi

  # 2) мягкий проход в окрестности объекта — ловим лучи, ореолы, тонкие детали
  if [ "$(soft_pass_for "$f")" = "1" ]; then
    local pad=$(( (bw > bh ? bw : bh) * 6 / 10 ))
    local rx=$(( bx - pad )); [ $rx -lt 0 ] && rx=0
    local ry=$(( by - pad )); [ $ry -lt 0 ] && ry=0
    local rw=$(( bx + bw + pad - rx )); [ $(( rx + rw )) -gt $W ] && rw=$(( W - rx ))
    local rh=$(( by + bh + pad - ry )); [ $(( ry + rh )) -gt $H ] && rh=$(( H - ry ))
    local sb; sb="$(bbox_of "$f" "$THRESH" 0 "${rw}x${rh}+${rx}+${ry}")"
    if [ -n "$sb" ]; then
      local sw sh sx sy; read -r sw sh sx sy <<<"$sb"
      bw=$sw; bh=$sh; bx=$(( rx + sx )); by=$(( ry + sy ))
    fi
  fi

  # 3) квадрат вокруг объекта с полем
  local obj=$(( bw > bh ? bw : bh ))
  local side; side="$(awk -v o="$obj" -v m="$MARGIN" 'BEGIN{printf "%d", o*(1+2*m)+0.5}')"
  [ $(( side % 2 )) -eq 1 ] && side=$(( side + 1 ))
  local limit; limit="$(awk -v w="$maxWH" -v s="$SKIP_ABOVE" 'BEGIN{printf "%d", w*s}')"
  if [ "$side" -ge "$limit" ]; then echo "skip  (already ${obj}/${maxWH})  $f"; return; fi

  local cx=$(( bx + bw / 2 )) cy=$(( by + bh / 2 ))
  local x0=$(( cx - side / 2 )) y0=$(( cy - side / 2 ))
  # сдвигаем квадрат внутрь кадра, если это возможно
  if [ "$side" -le "$W" ]; then
    [ $x0 -lt 0 ] && x0=0
    [ $(( x0 + side )) -gt $W ] && x0=$(( W - side ))
  fi
  if [ "$side" -le "$H" ]; then
    [ $y0 -lt 0 ] && y0=0
    [ $(( y0 + side )) -gt $H ] && y0=$(( H - side ))
  fi

  local maxside; maxside="$(max_side_for "$f")"
  local out_side=$(( side < maxside ? side : maxside ))
  local pct=$(( 100 * obj / maxWH ))
  echo "trim  ${W}x${H} obj ${bw}x${bh} (${pct}%) -> crop ${side}@${x0},${y0} -> ${out_side}px  $f"
  [ "$DRY" = "1" ] && return

  # цвет фона — усреднённый левый верхний угол (для добивки при выходе за кадр)
  local bg; bg="$(convert "$f" -gravity NorthWest -crop 12x12+0+0 +repage -scale '1x1!' -format '%[pixel:p{0,0}]' info:)"
  local tmp="${f}.trim.tmp.jpg"
  # добавляем рамку шириной side, чтобы кроп с отрицательным смещением был валиден
  convert "$f" \
    -bordercolor "$bg" -border "$side" \
    -crop "${side}x${side}+$(( x0 + side ))+$(( y0 + side ))" +repage \
    -resize "${out_side}x${out_side}>" \
    -strip -interlace Plane -sampling-factor 4:2:0 -quality "$QUALITY" \
    "$tmp"
  mv -f "$tmp" "$f"
}

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  while IFS= read -r f; do targets+=("$f"); done < <(
    find "$ASSETS/icons" "$ASSETS/nfts" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort
  )
fi

n=0
for f in "${targets[@]}"; do
  case "$f" in
    */backgrounds/*|*/brand/*) continue ;;
  esac
  process "$f"
  n=$(( n + 1 ))
done
echo "done: $n files"
