# Инструкция по развертыванию NeuroForge на Cloudflare Pages (бренд ex-Age of Farming)

Игра (клиентская часть на React + Vite) развёртывается через сервис **Cloudflare Pages**.

---

## Вариант 1: Автоматический деплой через GitHub (Рекомендуемый)

1. Зайдите в панель [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → вкладка **Pages** → **Connect to Git**.
2. Выберите репозиторий проекта `aof-` и целевую ветку (`main` или текущую рабочую).
3. Задайте настройки сборки (**Build settings**):
   * **Framework preset**: `Vite`
   * **Root directory**: `frontend`
   * **Build command**: `npm run build:release`
   * **Build output directory**: `dist`
4. В разделе **Environment variables** добавьте переменные:
   * `NODE_VERSION`: `20`
   * `VITE_SOLANA_NETWORK`: `mainnet-beta` (или `devnet` для тестов)
   * `VITE_RPC_URL`: публичный RPC без секретов либо HTTPS URL собственного RPC-прокси. **Все `VITE_*` публичны**; ключ провайдера хранится только на прокси. Прокси требует allowlist методов, лимиты запросов/размера и бюджета; не открытый relay
   * `VITE_API_URL`: `https://api.yourdomain.com` (адрес бэкенда)
   * `VITE_PROGRAM_ID`: `okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx`
5. Нажмите **Save and Deploy**. Cloudflare автоматически соберёт проект и выдаст адрес вида `https://aof-xxx.pages.dev`.

---

## Вариант 2: Ручной деплой через CLI (Wrangler)

Если нужно задеплоить собранный бандл напрямую из терминала:

1. Соберите фронтенд локально:
   ```bash
   cd frontend
   npm ci
   npm run build:release
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

## Юридический статус и публичные метаданные

`npm run build:release` больше не блокируется из-за незаполненного `operator.json` или снятых
юридических проектов. `npm run release:check` лишь сообщает о пробелах и возвращает код 0.
**Успешная сборка не означает юридического одобрения или готовности к публичному запуску.**
На `/legal/*` по-прежнему показывается уведомление об отсутствии опубликованных документов.

Без проверенных контакта и HTTPS origin сборка не создаёт `security.txt` и удаляет из вывода
sitemap с dev-адресом `localhost`; в `robots.txt` остаются лишь общие правила. После проверки
реквизитов и адресов с владельцем возможно отдельно выполнить
`node scripts/legal-release.mjs --emit-security` внутри `frontend` и проверить полученные
файлы, почтовый контакт, HTTP-заголовки и обработку запросов на реальном домене.
