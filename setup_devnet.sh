#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Age of Farming — Devnet Setup"
echo "=========================================="

cd aof_backend

# 1. Создаём все 26 SPL токенов
echo ""
echo "📦 Шаг 1: Создание SPL токенов..."

declare -a TOKEN_NAMES=(
  "FOOD" "WOOD" "STONE" "POTATO"
  "SEEDS" "WHEAT" "FLOUR" "BREAD" "WATER" "COAL" "MEAT"
  "STONE_BLUE" "STONE_PURPLE" "STONE_RED"
  "SAND_WHITE" "SAND_PINK" "SAND_YELLOW"
  "GEM_BLUE" "GEM_ORANGE" "GEM_WHITE" "GEM_GREEN"
  "FLASK_BLUE" "FLASK_YELLOW" "FLASK_GREEN" "FLASK_PINK" "FLASK_PURPLE"
  "LOVE_HEART"
)

mkdir -p ../tokens

for name in "${TOKEN_NAMES[@]}"; do
  FILE="../tokens/${name}.json"
  if [ -f "$FILE" ]; then
    echo "  ✓ $name уже создан"
  else
    echo "  ⏳ Создаю $name..."
    solana-keygen new --no-bip39-passphrase -o "$FILE" --force >/dev/null 2>&1
    ADDR=$(solana-keygen pubkey "$FILE")
    echo "    Адрес: $ADDR"
    
    # Создаём mint на devnet
    solana --url devnet spl-token create-token "$FILE" --decimals 9 2>&1 | grep -E "Creating|Signature|Error" || echo "    ⚠️ Не удалось создать"
  fi
done

# 2. Собираем адреса
echo ""
echo "📋 Шаг 2: Собираем адреса..."
FOOD=$(solana-keygen pubkey ../tokens/FOOD.json)
WOOD=$(solana-keygen pubkey ../tokens/WOOD.json)
STONE=$(solana-keygen pubkey ../tokens/STONE.json)
POTATO=$(solana-keygen pubkey ../tokens/POTATO.json)

# 3. Инициализация Config
echo ""
echo "⚙️ Шаг 3: Инициализация Config..."
curl -s -X POST http://localhost:8080/admin/initialize \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

# 4. Set Resource Mints (базовые)
echo ""
echo "⚙️ Шаг 4: Установка базовых минтов..."
curl -s -X POST http://localhost:8080/admin/set-resource-mints \
  -H "Content-Type: application/json" \
  -d "{
    \"foodMint\": \"$FOOD\",
    \"woodMint\": \"$WOOD\",
    \"stoneMint\": \"$STONE\"
  }" | python3 -m json.tool

# 5. Init MaterialMints (все 23)
echo ""
echo "⚙️ Шаг 5: Инициализация MaterialMints..."
SEEDS=$(solana-keygen pubkey ../tokens/SEEDS.json)
WHEAT=$(solana-keygen pubkey ../tokens/WHEAT.json)
FLOUR=$(solana-keygen pubkey ../tokens/FLOUR.json)
BREAD=$(solana-keygen pubkey ../tokens/BREAD.json)
WATER=$(solana-keygen pubkey ../tokens/WATER.json)
COAL=$(solana-keygen pubkey ../tokens/COAL.json)
MEAT=$(solana-keygen pubkey ../tokens/MEAT.json)
STONE_BLUE=$(solana-keygen pubkey ../tokens/STONE_BLUE.json)
STONE_PURPLE=$(solana-keygen pubkey ../tokens/STONE_PURPLE.json)
STONE_RED=$(solana-keygen pubkey ../tokens/STONE_RED.json)
SAND_WHITE=$(solana-keygen pubkey ../tokens/SAND_WHITE.json)
SAND_PINK=$(solana-keygen pubkey ../tokens/SAND_PINK.json)
SAND_YELLOW=$(solana-keygen pubkey ../tokens/SAND_YELLOW.json)
GEM_BLUE=$(solana-keygen pubkey ../tokens/GEM_BLUE.json)
GEM_ORANGE=$(solana-keygen pubkey ../tokens/GEM_ORANGE.json)
GEM_WHITE=$(solana-keygen pubkey ../tokens/GEM_WHITE.json)
GEM_GREEN=$(solana-keygen pubkey ../tokens/GEM_GREEN.json)
FLASK_BLUE=$(solana-keygen pubkey ../tokens/FLASK_BLUE.json)
FLASK_YELLOW=$(solana-keygen pubkey ../tokens/FLASK_YELLOW.json)
FLASK_GREEN=$(solana-keygen pubkey ../tokens/FLASK_GREEN.json)
FLASK_PINK=$(solana-keygen pubkey ../tokens/FLASK_PINK.json)
FLASK_PURPLE=$(solana-keygen pubkey ../tokens/FLASK_PURPLE.json)
LOVE_HEART=$(solana-keygen pubkey ../tokens/LOVE_HEART.json)

curl -s -X POST http://localhost:8080/admin/init-material-mints \
  -H "Content-Type: application/json" \
  -d "{
    \"seeds\": \"$SEEDS\",
    \"wheat\": \"$WHEAT\",
    \"flour\": \"$FLOUR\",
    \"bread\": \"$BREAD\",
    \"water\": \"$WATER\",
    \"coal\": \"$COAL\",
    \"meat\": \"$MEAT\",
    \"stoneBlue\": \"$STONE_BLUE\",
    \"stonePurple\": \"$STONE_PURPLE\",
    \"stoneRed\": \"$STONE_RED\",
    \"sandWhite\": \"$SAND_WHITE\",
    \"sandPink\": \"$SAND_PINK\",
    \"sandYellow\": \"$SAND_YELLOW\",
    \"gemBlue\": \"$GEM_BLUE\",
    \"gemOrange\": \"$GEM_ORANGE\",
    \"gemWhite\": \"$GEM_WHITE\",
    \"gemGreen\": \"$GEM_GREEN\",
    \"flaskBlue\": \"$FLASK_BLUE\",
    \"flaskYellow\": \"$FLASK_YELLOW\",
    \"flaskGreen\": \"$FLASK_GREEN\",
    \"flaskPink\": \"$FLASK_PINK\",
    \"flaskPurple\": \"$FLASK_PURPLE\",
    \"loveHeart\": \"$LOVE_HEART\"
  }" | python3 -m json.tool

echo ""
echo "=========================================="
echo "✅ Сетап завершён!"
echo "=========================================="
echo ""
echo "Адреса токенов сохранены в ../tokens/"
