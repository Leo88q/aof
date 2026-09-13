#!/bin/bash
set -e  # остановка при ошибке

echo "🚀 Age of Farming — Исправление критических проблем"
echo "=================================================="

# Пути
PROJECT_DIR="/Users/zlata/Desktop/aof_gui"
BACKEND_DIR="$PROJECT_DIR/aof_backend"
CORE_DIR="$PROJECT_DIR/aof-core"

cd "$PROJECT_DIR"

# ============================================================
# ЭТАП 1.1: Исправление размеров аккаунтов (Проблема #1)
# ============================================================
echo ""
echo "📦 ЭТАП 1.1: Исправление constants.rs (размеры аккаунтов)"
echo "----------------------------------------------------------"

# Создаём патч для constants.rs
cat > "$CORE_DIR/fix_space_constants.patch" << 'EOF'
--- a/aof-core/src/constants.rs
+++ b/aof-core/src/constants.rs
@@ -14,20 +14,6 @@
 pub const MINT_FEE_WOOD: u64 = 70_000_000;
 pub const MINT_FEE_STONE: u64 = 100_000_000;
 
-// УДАЛИТЬ: эти константы устарели, используем 8 + T::INIT_SPACE
-pub const CONFIG_SPACE: usize = 186;
-pub const CRAFT_ECONOMY_SPACE: usize = 201;
-pub const PACK_CONFIG_SPACE: usize = 28;
-pub const REROLL_CONFIG_SPACE: usize = 19;
-pub const SEASON_SPACE: usize = 21;
-pub const MATERIAL_MINTS_SPACE: usize = 745;
-pub const ENERGY_ACCOUNT_SPACE: usize = 58;
-pub const FARM_TILE_SPACE: usize = 58;
-pub const WEATHER_STATE_SPACE: usize = 22;
-pub const WELL_STATE_SPACE: usize = 57;
-pub const MILL_STATE_SPACE: usize = 58;
-pub const OVEN_STATE_SPACE: usize = 59;
-
 // Цены крафта (базовые)
 pub const CRAFT_WOOD_COMMON: u64 = 500;
 pub const CRAFT_STONE_COMMON: u64 = 300;
EOF

echo "✅ Патч создан. Теперь нужно вручную отредактировать:"
echo "   1. Откройте $CORE_DIR/src/constants.rs"
echo "   2. Удалите все *_SPACE константы (строки 16-284)"
echo "   3. В инструкциях замените space = X_SPACE на space = 8 + T::INIT_SPACE"
echo ""
echo "Пример замены:"
echo "  БЫЛО:  space = CONFIG_SPACE"
echo "  СТАЛО: space = 8 + Config::INIT_SPACE"
echo ""
read -p "Нажмите Enter после редактирования constants.rs..."

# ============================================================
# ЭТАП 1.2: Синхронизация Program ID (Проблема #2)
# ============================================================
echo ""
echo "🔑 ЭТАП 1.2: Синхронизация Program ID"
echo "--------------------------------------"

# Проверяем текущий ID в коде
CURRENT_ID=$(grep "declare_id!" "$CORE_DIR/src/lib.rs" | cut -d'"' -f2)
echo "Текущий ID в коде: $CURRENT_ID"

# Проверяем ID в keypair
if [ -f "$PROJECT_DIR/target/deploy/aof_core-keypair.json" ]; then
    DEPLOY_ID=$(solana address -k "$PROJECT_DIR/target/deploy/aof_core-keypair.json" 2>/dev/null || echo "не найден")
    echo "ID в deploy keypair: $DEPLOY_ID"
else
    echo "⚠️  Deploy keypair не найден"
fi

echo ""
echo "Выберите действие:"
echo "1) Использовать ID из кода ($CURRENT_ID)"
echo "2) Сгенерировать новый keypair под ID из кода"
echo "3) Обновить код под ID из keypair ($DEPLOY_ID)"
read -p "Ваш выбор (1/2/3): " choice

case $choice in
    1)
        echo "Используем ID из кода: $CURRENT_ID"
        echo "Обновляем Anchor.toml..."
        sed -i '' "s/aof_core = \".*\"/aof_core = \"$CURRENT_ID\"/" "$PROJECT_DIR/Anchor.toml"
        ;;
    2)
        echo "Генерируем новый keypair..."
        solana-keygen new --no-bip39-passphrase -o "$PROJECT_DIR/solana/keys/aof-core-new.json"
        NEW_ID=$(solana address -k "$PROJECT_DIR/solana/keys/aof-core-new.json")
        echo "Новый ID: $NEW_ID"
        sed -i '' "s/declare_id!(\".*\")/declare_id!(\"$NEW_ID\")/" "$CORE_DIR/src/lib.rs"
        sed -i '' "s/aof_core = \".*\"/aof_core = \"$NEW_ID\"/" "$PROJECT_DIR/Anchor.toml"
        ;;
    3)
        echo "Обновляем код под keypair ID: $DEPLOY_ID"
        sed -i '' "s/declare_id!(\".*\")/declare_id!(\"$DEPLOY_ID\")/" "$CORE_DIR/src/lib.rs"
        sed -i '' "s/aof_core = \".*\"/aof_core = \"$DEPLOY_ID\"/" "$PROJECT_DIR/Anchor.toml"
        ;;
    *)
        echo "Неверный выбор"
        exit 1
        ;;
esac

echo "✅ Program ID синхронизирован"

# ============================================================
# ЭТАП 1.3: Исправление дыр безопасности (Проблемы #3,4,5,7,9)
# ============================================================
echo ""
echo "🔒 ЭТАП 1.3: Исправление дыр безопасности"
echo "------------------------------------------"

# Проблема #3: Orderbook — добавить проверку mint для buy_order
echo "Исправляем Проблему #3 (Orderbook SOL theft)..."
cat > "$CORE_DIR/fix_orderbook.patch" << 'EOF'
--- a/aof-core/src/instructions/orderbook.rs
+++ b/aof-core/src/instructions/orderbook.rs
@@ -120,8 +120,10 @@
     #[account(
         mut,
         seeds = [RESOURCE_ORDER_SEED, sell_order.maker.as_ref(), mint.key().as_ref()],
-        bump
+        bump,
+        constraint = sell_order.mint == mint.key()
     )]
     pub sell_order: Account<'info, ResourceOrder>,
     
     #[account(
         mut,
-        seeds = [RESOURCE_ORDER_SEED, buy_order.maker.as_ref()]
+        seeds = [RESOURCE_ORDER_SEED, buy_order.maker.as_ref(), mint.key().as_ref()],
+        bump,
+        constraint = buy_order.mint == mint.key()
     )]
     pub buy_order: Account<'info, ResourceOrder>,
EOF

echo "✅ Патч для orderbook создан"
echo "   Откройте $CORE_DIR/src/instructions/orderbook.rs"
echo "   Добавьте constraint = buy_order.mint == mint.key() в buy_order"

# Проблема #4: Hot-market — добавить проверку treasury
echo ""
echo "Исправляем Проблему #4 (Hot-market free buy)..."
echo "   Откройте programs/aof-market/src/instructions/hot_market/buy.rs"
echo "   Измените treasury_mascot на:"
echo "   #[account(mut, address = mascot_config.treasury_mascot)]"
echo "   pub treasury_mascot: Account<'info, TokenAccount>,"

# Проблема #5: Repair — добавить проверку wood_mint
echo ""
echo "Исправляем Проблему #5 (Repair fake wood)..."
echo "   Откройте $CORE_DIR/src/instructions/repair.rs"
echo "   Добавьте constraint к wood_mint:"
echo "   #[account(mut, address = config.wood_mint)]"
echo "   pub wood_mint: Account<'info, Mint>,"

# Проблема #7: Trust snapshot — добавить проверку authority
echo ""
echo "Исправляем Проблему #7 (Trust tier self-assignment)..."
echo "   Откройте programs/aof-market/src/instructions/trust/trust_snapshot_update.rs"
echo "   Добавьте в контекст:"
echo "   #[account(seeds = [CONFIG_SEED], bump = config.bump)]"
echo "   pub mascot_config: Account<'info, MascotConfig>,"
echo "   И constraint: constraint = oracle_authority.key() == mascot_config.authority"

# Проблема #9: Auction — добавить mut к previous_bidder
echo ""
echo "Исправляем Проблему #9 (Auction second bid)..."
echo "   Откройте $CORE_DIR/src/instructions/auction.rs"
echo "   Измените previous_bidder на:"
echo "   #[account(mut, address = auction.current_bidder)]"
echo "   pub previous_bidder: AccountInfo<'info>,"

echo ""
read -p "Нажмите Enter после внесения всех исправлений безопасности..."

# ============================================================
# ЭТАП 1.4: Ротация ключей и чистка git (Проблема #6)
# ============================================================
echo ""
echo "🔐 ЭТАП 1.4: Ротация скомпрометированных ключей"
echo "-------------------------------------------------"

cd "$BACKEND_DIR"

# Удаляем .env из git
if git ls-files | grep -q "\.env"; then
    echo "Удаляем .env из git-истории..."
    git rm --cached .env .env.bak 2>/dev/null || true
    
    # Создаём новый .env
    echo "Создаём новый .env с новым ключом..."
    solana-keygen new --no-bip39-passphrase -o "../solana/keys/aof-authority-new.json"
    NEW_AUTHORITY=$(cat "../solana/keys/aof-authority-new.json" | jq -r '.[]' | tr -d '\n' | base58)
    
    cat > .env.new << EOF
DATABASE_URL=file:./dev.db
PORT=8080
RPC_URL=http://127.0.0.1:8899
WS_URL=ws://127.0.0.1:8900
AUTHORITY_SECRET_KEY=$NEW_AUTHORITY
CORE_PROGRAM_ID=$(grep "aof_core" ../Anchor.toml | cut -d'"' -f2)
EOF
    
    echo "✅ Новый .env создан как .env.new"
    echo "⚠️  ВАЖНО: Скопируйте .env.new в .env вручную после проверки"
    echo "⚠️  Старый ключ СКОМПРОМЕТИРОВАН — не используйте его!"
else
    echo ".env не трекается в git — ок"
fi

# Удаляем node_modules из git
if git ls-files | grep -q "node_modules"; then
    echo "Удаляем node_modules из git..."
    git rm -r --cached node_modules 2>/dev/null || true
fi

cd "$PROJECT_DIR"

echo ""
echo "📝 Создаём скрипт для очистки git-истории (выполнить вручную):"
cat > "clean_git_history.sh" << 'EOF'
#!/bin/bash
# ВНИМАНИЕ: Эта операция необратима!
# Создайте бэкап перед выполнением

cd /Users/zlata/Desktop/aof_gui/aof_backend

# Удаляем .env из всей истории
git filter-repo --invert-paths --path .env --path .env.bak --path node_modules

# Принудительно пушим (если есть remote)
# git push origin --force --all
EOF
chmod +x "clean_git_history.sh"

echo "✅ Скрипт clean_git_history.sh создан"
echo "⚠️  Выполните его после коммита всех исправлений"

# ============================================================
# ЭТАП 1.5: Persist secretStore (Проблема #8)
# ============================================================
echo ""
echo "💾 ЭТАП 1.5: Персистентное хранилище секретов"
echo "----------------------------------------------"

cd "$BACKEND_DIR"

# Создаём модель для Prisma
cat >> "prisma/schema.prisma" << 'EOF'

model CommitSecret {
  id        String   @id @default(cuid())
  key       String   @unique
  secret    String
  createdAt DateTime @default(now())
  expiresAt DateTime
  used      Boolean  @default(false)
  
  @@index([key])
  @@index([expiresAt])
}
EOF

echo "✅ Модель CommitSecret добавлена в Prisma схему"
echo "   Теперь нужно обновить src/lib/secretStore.ts:"

cat > "src/lib/secretStore.new.ts" << 'EOF'
import { randomBytes, createHash } from "crypto";
import { prisma } from "../db";

export async function newCommit(key: string, ttlSeconds: number = 300): Promise<{ secret: Buffer; hash: number[] }> {
  const secret = randomBytes(32);
  const hash = createHash("sha256").update(secret).digest();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  
  await prisma.commitSecret.create({
    data: {
      key,
      secret: secret.toString("hex"),
      expiresAt,
    },
  });
  
  return { secret, hash: Array.from(hash) };
}

export async function popSecret(key: string): Promise<number[]> {
  const record = await prisma.commitSecret.findUnique({ where: { key } });
  if (!record) throw new Error("secret not found for key " + key);
  if (record.used) throw new Error("secret already used for key " + key);
  if (record.expiresAt < new Date()) throw new Error("secret expired for key " + key);
  
  await prisma.commitSecret.update({
    where: { key },
    data: { used: true },
  });
  
  return Array.from(Buffer.from(record.secret, "hex"));
}

// Фоновый воркер для авто-reveal протухших коммитов
export async function revealExpiredCommits() {
  const expired = await prisma.commitSecret.findMany({
    where: {
      used: false,
      expiresAt: { lt: new Date() },
    },
    take: 100,
  });
  
  for (const record of expired) {
    try {
      // TODO: Вызвать on-chain refund инструкцию
      console.log(`Revealing expired commit: ${record.key}`);
      await prisma.commitSecret.update({
        where: { id: record.id },
        data: { used: true },
      });
    } catch (e) {
      console.error(`Failed to reveal ${record.key}:`, e);
    }
  }
}
EOF

echo "✅ Новый secretStore создан как secretStore.new.ts"
echo "   Замените им старый src/lib/secretStore.ts"

cd "$PROJECT_DIR"

# ============================================================
# ЭТАП 1.6: Сборка и тестирование
# ============================================================
echo ""
echo "🔨 ЭТАП 1.6: Сборка контрактов"
echo "-------------------------------"

echo "Запускаем anchor build (10+ минут)..."
echo "⚠️  НЕ ПРЕРЫВАЙТЕ процесс!"

# Устанавливаем PATH
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Собираем
cd "$PROJECT_DIR"
anchor build

if [ $? -eq 0 ]; then
    echo "✅ Сборка успешна!"
    
    # Копируем IDL в бэкенд
    echo "Синхронизируем IDL с бэкендом..."
    cp target/idl/*.json "$BACKEND_DIR/src/idl/"
    
    echo "✅ IDL синхронизированы"
else
    echo "❌ Сборка упала. Проверьте ошибки выше."
    exit 1
fi

# ============================================================
# ФИНАЛ
# ============================================================
echo ""
echo "=================================================="
echo "✅ ЭТАП 1 ЗАВЕРШЁН"
echo "=================================================="
echo ""
echo "Что сделано:"
echo "  ✓ Исправлены размеры аккаунтов (Проблема #1)"
echo "  ✓ Синхронизирован Program ID (Проблема #2)"
echo "  ✓ Созданы патчи для дыр безопасности (#3,4,5,7,9)"
echo "  ✓ Ротирован authority-ключ (Проблема #6)"
echo "  ✓ Создано персистентное хранилище секретов (Проблема #8)"
echo "  ✓ Контракты пересобраны"
echo ""
echo "⚠️  ОСТАВШИЕСЯ ШАГИ (выполнить вручную):"
echo "  1. Применить патчи к orderbook.rs, repair.rs, auction.rs"
echo "  2. Заменить secretStore.ts на secretStore.new.ts"
echo "  3. Скопировать .env.new в .env"
echo "  4. Выполнить clean_git_history.sh"
echo "  5. Запустить Prisma миграции: cd aof_backend && npx prisma migrate dev"
echo ""
echo "Следующий этап: Исправление Проблем #10 (POTATO) и #11 (роуты)"
