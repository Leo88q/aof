# Инструкция по развертыванию NeuroForge на Cloudflare Pages (бренд ex-Age of Farming)

Игра (клиентская часть на React + Vite) развёртывается через сервис **Cloudflare Pages**.

---

## Вариант 1: Автоматический деплой через GitHub (Рекомендуемый)

1. Зайдите в панель [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → вкладка **Pages** → **Connect to Git**.
2. Выберите репозиторий проекта `aof-` и целевую ветку (`main` или текущую рабочую).
3. Задайте настройки сборки (**Build settings**):
   * **Framework preset**: `Vite`
   * **Root directory**: `frontend`
   * **Build command**: `npm run build`
   * **Build output directory**: `dist`
4. В разделе **Environment variables** добавьте переменные:
   * `NODE_VERSION`: `20`
   * `VITE_SOLANA_NETWORK`: `mainnet-beta` (или `devnet` для тестов)
   * `VITE_RPC_URL`: `https://mainnet.helius-rpc.com/?api-key=ВАШ_КЛЮЧ`
   * `VITE_API_URL`: `https://api.yourdomain.com` (адрес бэкенда)
   * `VITE_PROGRAM_ID`: `HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq`
5. Нажмите **Save and Deploy**. Cloudflare автоматически соберёт проект и выдаст адрес вида `https://aof-xxx.pages.dev`.

---

## Вариант 2: Ручной деплой через CLI (Wrangler)

Если нужно задеплоить собранный бандл напрямую из терминала:

1. Соберите фронтенд локально:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
2. Разверните скомпилированную папку `dist` через Wrangler:
   ```bash
   npx wrangler pages deploy dist --project-name=age-of-farming
   ```
3. При первом запуске терминал откроет окно авторизации в Cloudflare.

---

## Важные файлы конфигурации (уже добавлены в репозиторий):
* `frontend/public/_routes.json` — настройка роутинга для SPA.
* `frontend/public/_headers` — заголовки безопасности и кэширование статики.
