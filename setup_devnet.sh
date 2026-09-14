#!/bin/bash
set -e

: "${ADMIN_TOKEN:?Set ADMIN_TOKEN before running setup_devnet.sh}"
: "${PROGRAM_ID:?Set PROGRAM_ID before running setup_devnet.sh}"

# mint_resource accepts only the program's auth PDA as mint authority.
AUTH_PDA=$(node -e 'const {PublicKey}=require("@solana/web3.js"); console.log(PublicKey.findProgramAddressSync([Buffer.from("auth")], new PublicKey(process.env.PROGRAM_ID))[0].toBase58())')
echo "🔐 Resource mint authority PDA: $AUTH_PDA"

echo "=========================================="
echo "🚀 Age of Farming — Devnet Setup"
echo "=========================================="

cd aof_backend

# 1. Создаём все 27 канонических SPL-токенов
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
    
    # Создаём mint на devnet. Владелец mint сразу после этого будет заменён
    # на auth PDA ниже; без этого on-chain mint_resource отклонит mint.
    solana --url devnet spl-token create-token "$FILE" --decimals 9 2>&1 | grep -E "Creating|Signature|Error" || {
      echo "    ❌ Не удалось создать $name" >&2
      exit 1
    }
  fi

  ADDR=$(solana-keygen pubkey "$FILE")
  CURRENT_AUTH=$(solana --url devnet spl-token display "$ADDR" 2>/dev/null | awk -F': ' '/Mint authority/ {print $2; exit}')
  if [ "$CURRENT_AUTH" != "$AUTH_PDA" ]; then
    echo "    🔁 Назначаю mint authority на auth PDA..."
    solana --url devnet spl-token authorize "$ADDR" mint "$AUTH_PDA" >/dev/null
  else
    echo "    ✓ Mint authority уже auth PDA"
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
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' | python3 -m json.tool

# 4. Set Resource Mints (базовые + хлебная цепочка)
echo ""
echo "⚙️ Шаг 4: Установка базовых минтов..."
SEEDS=$(solana-keygen pubkey ../tokens/SEEDS.json)
WATER=$(solana-keygen pubkey ../tokens/WATER.json)
curl -s -X POST http://localhost:8080/admin/set-resource-mints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"foodMint\": \"$FOOD\",
    \"woodMint\": \"$WOOD\",
    \"stoneMint\": \"$STONE\",
    \"seedsMint\": \"$SEEDS\",
    \"waterMint\": \"$WATER\",
    \"potatoMint\": \"$POTATO\"
  }" | python3 -m json.tool

# 5. Init MaterialMints (все 23)
echo ""
echo "⚙️ Шаг 5: Инициализация MaterialMints..."
WHEAT=$(solana-keygen pubkey ../tokens/WHEAT.json)
FLOUR=$(solana-keygen pubkey ../tokens/FLOUR.json)
BREAD=$(solana-keygen pubkey ../tokens/BREAD.json)
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
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"mints\": {
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
  }}" | python3 -m json.tool

echo ""
echo "=========================================="
echo "✅ Сетап завершён!"
echo "=========================================="
echo ""
echo "Адреса токенов сохранены в ../tokens/"
