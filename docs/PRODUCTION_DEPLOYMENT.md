# Инструкция по развертыванию в Production (Solana Mainnet-Beta)

Данное руководство описывает пошаговый процесс деплоя проекта Age of Farming (AOF) в боевое окружение.

---

## 1. Архитектура Product Launch v1.0

В версии 1.0 активен и защищен проверенный игровой цикл:
* **Core-ферма**: вода, посадка семян, рост, сбор урожая, мельница, печь.
* **Инструменты**: починка, стейкинг, миграция, базовый крафт.
* **Паки и кузница**: защищенный escrow-контракт с возможностью отзыва средств через `pack_open_expire` и `forge_attempt_expire`.
* **Рынок**: фикс. листинги, аукционы, офферы, ордербук.
* **Безопасность**: 8 незавершенных механик (лотерея, случайный реролл, барабан, хот-маркет, сессионные ключи, ребёрф, коллекционный стейкинг, экспедиции) переведены в режим fail-closed, заблокированы on-chain и снабжены предупреждениями в UI, исключая потерю средств пользователей.

---

## 2. База данных: Миграция с SQLite на PostgreSQL

Для продакшена SQLite не подходит из-за блокировок при конкурентных запросах.

### Шаг 1: Подготовка PostgreSQL
1. Запустите PostgreSQL 16 (например, через приложенный `docker-compose.prod.yml` или облачный сервис Supabase / AWS RDS / Neon).
2. Создайте базу данных `aof_production` и пользователя с правами.
3. В `schema.prisma` переключите провайдер:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Выполните накат схемы:
   ```bash
   cd aof_backend
   DATABASE_URL="postgresql://user:pass@host:5432/aof_production?schema=public" npx prisma db push
   # либо npx prisma migrate deploy
   ```

---

## 3. Настройка Production RPC и Ключей

1. **RPC Провайдер**:
   * Для mainnet требуется выделенный RPC с поддержкой DAS API (Helius, Triton, QuickNode).
   * Задайте `RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`.
2. **Squads Multisig**:
   * Все authority программы и казна (`TREASURY_PUBKEY`) должны принадлежать мультисиг-кошельку Squads v4.
3. **Commit Expirer & Price Cranker воркеры**:
   * Снабдите crank-кошелек небольшим запасом SOL (1-2 SOL) для вызова транзакций отзыва просроченных коммитов.

---

## 4. Запуск сервисов через Docker Compose

В корне репозитория подготовлен `docker-compose.prod.yml`:

```bash
# 1. Создайте и заполните aof_backend/.env на основе .env.example
cp aof_backend/.env.example aof_backend/.env
# Заполните боевые RPC_URL, PROGRAM_ID, AUTHORITY_SECRET_KEY, TREASURY_PUBKEY, ADMIN_TOKEN

# 2. Запустите кластер
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Проверьте логи
docker-compose -f docker-compose.prod.yml logs -f backend
```

---

## 5. Деплой Frontend

1. Установите переменные окружения фронтенда в `frontend/.env`:
   ```bash
   VITE_SOLANA_NETWORK=mainnet-beta
   VITE_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
   VITE_PROGRAM_ID=HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq
   VITE_API_URL=https://api.yourdomain.com
   ```
2. Сборка статики:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
3. Разверните содержимое `frontend/dist` через Cloudflare Pages, Vercel или Nginx.
