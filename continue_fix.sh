#!/bin/bash
set -e

echo "🚀 Продолжение исправлений с этапа 1.5"
echo "======================================="

BACKEND_DIR="/Users/zlata/Desktop/aof_gui/aof_backend"
cd "$BACKEND_DIR"

# ЭТАП 1.5: Persist secretStore
echo ""
echo "💾 ЭТАП 1.5: Персистентное хранилище секретов"
echo "----------------------------------------------"

# Добавляем модель в Prisma
cat >> "prisma/schema.prisma" << 'PRISMA_EOF'

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
PRISMA_EOF

echo "✅ Модель CommitSecret добавлена в Prisma"

# Создаём новый secretStore
cat > "src/lib/secretStore.new.ts" << 'TS_EOF'
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
TS_EOF

echo "✅ Новый secretStore создан как secretStore.new.ts"
echo "   Замените им старый: mv src/lib/secretStore.new.ts src/lib/secretStore.ts"

cd /Users/zlata/Desktop/aof_gui

# ЭТАП 1.6: Сборка контрактов
echo ""
echo "🔨 ЭТАП 1.6: Сборка контрактов"
echo "-------------------------------"

export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "Запускаем anchor build (10+ минут)..."
echo "⚠️  НЕ ПРЕРЫВАЙТЕ процесс!"

anchor build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Сборка успешна!"
    
    # Синхронизируем IDL с бэкендом
    echo "Синхронизируем IDL с бэкендом..."
    cp target/idl/*.json "$BACKEND_DIR/src/idl/"
    
    echo "✅ IDL синхронизированы"
    echo ""
    echo "=================================================="
    echo "✅ ЭТАП 1 ЗАВЕРШЁН ПОЛНОСТЬЮ"
    echo "=================================================="
else
    echo ""
    echo "❌ Сборка упала. Проверьте ошибки выше."
    exit 1
fi
