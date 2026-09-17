# Production Deployment Final Checklist

## 1. Смарт-контракты (Solana)
- [x] Все 6 программ синхронизированы с IDL (Drift = 0).
- [x] Все 52 mint CPI поля проверены статическим анализатором (все `writable`).
- [x] 8 недоработанных механик переведены в fail-closed on-chain (`FeatureDisabled`).
- [x] Паки и Кузница защищены escrow-логикой на PDA с механизмами экспирации и возврата.
- [ ] Развертывание в Mainnet-Beta через Squads Multisig v4.
- [ ] Инициализация канонических параметров `init_config` и минтов ресурсов на mainnet.

## 2. Backend & Workers
- [x] CAS-идемпотентность и криптографическая проверка подписей ed25519.
- [x] Подготовлен multi-stage `Dockerfile` для backend.
- [x] Подготовлен боевой `docker-compose.prod.yml` с PostgreSQL 16.
- [x] Сконфигурированы демоны `commit-expirer` и `price-cranker`.
- [ ] Подключение production RPC с DAS API (Helius / Triton).
- [ ] Заполнение секретов окружения в `.env` (Authority keypair, Admin token, Treasury).

## 3. Frontend dApp
- [x] Проверка дизайн-токенов и отсутствие сырых CSS-цветов.
- [x] Сборка Vite проходит без ошибок TypeScript.
- [x] Блокировка вызовов недоступных механик через `FeatureDisabledNotice`.
- [ ] Установка production RPC URL и канонического `PROGRAM_ID` в `frontend/.env`.
- [ ] Деплой статического бандла `frontend/dist` в Cloudflare Pages / Vercel.

## 4. Безопасность и данные
- [x] База данных исключена из Git-трекинга.
- [x] Подготовлена инструкция по развертыванию `docs/PRODUCTION_DEPLOYMENT.md`.
- [ ] Санитарная очистка истории репозитория (удаление исторических дампов через git filter-repo).
