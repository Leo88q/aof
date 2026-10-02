#!/bin/bash
set -e

: "${ADMIN_TOKEN:?Set ADMIN_TOKEN before running setup_devnet.sh}"
: "${PROGRAM_ID:?Set PROGRAM_ID before running setup_devnet.sh}"

# mint_resource accepts only the program's auth PDA as mint authority.
AUTH_PDA=$(node -e 'const {PublicKey}=require("@solana/web3.js"); console.log(PublicKey.findProgramAddressSync([Buffer.from("auth")], new PublicKey(process.env.PROGRAM_ID))[0].toBase58())')
echo "🔐 Resource mint authority PDA: $AUTH_PDA"

echo "=========================================="
echo "🚀 NeuroForge — Devnet Setup"
echo "=========================================="

cd aof_backend

# 1. Создаём все 27 канонических SPL-токенов
echo ""
echo "📦 Шаг 1: Проверка сохранённых ключей и создание SPL токенов..."

declare -a TOKEN_NAMES=(
  "DATA" "CIRCUIT" "SILICON" "MIND"
  "NEURON" "SYNAPSE" "SIGNAL" "MODEL" "POWER" "COMPUTE" "DATASET"
  "BLUE_CORE" "PURPLE_CORE" "RED_CORE"
  "CLEAR_QUARTZ" "ROSE_QUARTZ" "AMBER_QUARTZ"
  "QUANTUM_BIT" "NEURAL_CHIP" "PHOTON_BIT" "BIO_CHIP"
  "CRYO_FLUID" "VOLT_FLUID" "BIO_FLUID" "NANO_FLUID" "QUANTUM_FLUID"
  "SOUL_CORE"
)

mkdir -p ../tokens

for name in "${TOKEN_NAMES[@]}"; do
  FILE="../tokens/${name}.json"
  if [ ! -f "$FILE" ]; then
    echo "  ❌ Отсутствует заранее выданный ключ минтера $FILE" >&2
    echo "     Скрипт не генерирует и не заменяет ключи. Восстановите прежний keypair без изменения содержимого." >&2
    exit 1
  fi
  echo "  ✓ Сохраняю существующий keypair для $name"
  ADDR=$(solana-keygen pubkey "$FILE")
  echo "    Адрес: $ADDR"

  # Создаём mint на devnet. Владелец mint сразу после этого будет заменён
  # на auth PDA ниже; без этого on-chain mint_resource отклонит mint.
  solana --url devnet spl-token create-token "$FILE" --decimals 9 2>&1 | grep -E "Creating|Signature|Error" || {
    echo "    ❌ Не удалось создать $name" >&2
    exit 1
  }

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
DATA=$(solana-keygen pubkey ../tokens/DATA.json)
CIRCUIT=$(solana-keygen pubkey ../tokens/CIRCUIT.json)
SILICON=$(solana-keygen pubkey ../tokens/SILICON.json)
MIND=$(solana-keygen pubkey ../tokens/MIND.json)

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
NEURON=$(solana-keygen pubkey ../tokens/NEURON.json)
POWER=$(solana-keygen pubkey ../tokens/POWER.json)
curl -s -X POST http://localhost:8080/admin/set-resource-mints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"dataMint\": \"$DATA\",
    \"circuitMint\": \"$CIRCUIT\",
    \"siliconMint\": \"$SILICON\",
    \"neuronMint\": \"$NEURON\",
    \"powerMint\": \"$POWER\",
    \"mindMint\": \"$MIND\"
  }" | python3 -m json.tool

# 5. Init MaterialMints (все 23)
echo ""
echo "⚙️ Шаг 5: Инициализация MaterialMints..."
SYNAPSE=$(solana-keygen pubkey ../tokens/SYNAPSE.json)
SIGNAL=$(solana-keygen pubkey ../tokens/SIGNAL.json)
MODEL=$(solana-keygen pubkey ../tokens/MODEL.json)
COMPUTE=$(solana-keygen pubkey ../tokens/COMPUTE.json)
DATASET=$(solana-keygen pubkey ../tokens/DATASET.json)
BLUE_CORE=$(solana-keygen pubkey ../tokens/BLUE_CORE.json)
PURPLE_CORE=$(solana-keygen pubkey ../tokens/PURPLE_CORE.json)
RED_CORE=$(solana-keygen pubkey ../tokens/RED_CORE.json)
CLEAR_QUARTZ=$(solana-keygen pubkey ../tokens/CLEAR_QUARTZ.json)
ROSE_QUARTZ=$(solana-keygen pubkey ../tokens/ROSE_QUARTZ.json)
AMBER_QUARTZ=$(solana-keygen pubkey ../tokens/AMBER_QUARTZ.json)
QUANTUM_BIT=$(solana-keygen pubkey ../tokens/QUANTUM_BIT.json)
NEURAL_CHIP=$(solana-keygen pubkey ../tokens/NEURAL_CHIP.json)
PHOTON_BIT=$(solana-keygen pubkey ../tokens/PHOTON_BIT.json)
BIO_CHIP=$(solana-keygen pubkey ../tokens/BIO_CHIP.json)
CRYO_FLUID=$(solana-keygen pubkey ../tokens/CRYO_FLUID.json)
VOLT_FLUID=$(solana-keygen pubkey ../tokens/VOLT_FLUID.json)
BIO_FLUID=$(solana-keygen pubkey ../tokens/BIO_FLUID.json)
NANO_FLUID=$(solana-keygen pubkey ../tokens/NANO_FLUID.json)
QUANTUM_FLUID=$(solana-keygen pubkey ../tokens/QUANTUM_FLUID.json)
SOUL_CORE=$(solana-keygen pubkey ../tokens/SOUL_CORE.json)

curl -s -X POST http://localhost:8080/admin/init-material-mints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"mints\": {
    \"neuron\": \"$NEURON\",
    \"synapse\": \"$SYNAPSE\",
    \"signal\": \"$SIGNAL\",
    \"model\": \"$MODEL\",
    \"power\": \"$POWER\",
    \"compute\": \"$COMPUTE\",
    \"dataset\": \"$DATASET\",
    \"blueCore\": \"$BLUE_CORE\",
    \"purpleCore\": \"$PURPLE_CORE\",
    \"redCore\": \"$RED_CORE\",
    \"clearQuartz\": \"$CLEAR_QUARTZ\",
    \"roseQuartz\": \"$ROSE_QUARTZ\",
    \"amberQuartz\": \"$AMBER_QUARTZ\",
    \"quantumBit\": \"$QUANTUM_BIT\",
    \"neuralChip\": \"$NEURAL_CHIP\",
    \"photonBit\": \"$PHOTON_BIT\",
    \"bioChip\": \"$BIO_CHIP\",
    \"cryoFluid\": \"$CRYO_FLUID\",
    \"voltFluid\": \"$VOLT_FLUID\",
    \"bioFluid\": \"$BIO_FLUID\",
    \"nanoFluid\": \"$NANO_FLUID\",
    \"quantumFluid\": \"$QUANTUM_FLUID\",
    \"soulCore\": \"$SOUL_CORE\"
  }}" | python3 -m json.tool

echo ""
echo "=========================================="
echo "✅ Сетап завершён!"
echo "=========================================="
echo ""
echo "Адреса токенов сохранены в ../tokens/"
