# Mainnet release gates — 2026-09-20

**Текущий статус: NO-GO.** Исправления в Git не являются deployment и не закрывают все риски. Источник деталей: [AUDIT_2026-09-20.md](../AUDIT_2026-09-20.md).

## Выполнено локально
- [x] Frontend build и новые wallet-guard/confirmation unit tests.
- [x] Backend typecheck, proof/route/lifecycle regression tests (RPC mocked).
- [x] IDL/account flags и mint-writable static checks.
- [x] Новые unsafe pack/forge commitments отключены, legacy refund/reveal код сохранён.
- [x] Добавлены permanent RewardReceipt и finalized recovery/quarantine для inbox (Rust runtime пока не проверен).
- [x] SQL smoke трёх migrations, durable pagination cursor и legacy version=0 quarantine.
- [x] Bounded marketplace instruction и локальный buyer intent; старый unbounded buy запрещён.
- [x] 12 frontend security tests; backend receipt/codec/reconciliation tests; ABI gate проверяет точные типы/порядок аргументов.
- [x] Добавлен offline compression cost model и архитектурный план.

## Обязательно до release
- [ ] Полный backend build с Prisma engines; migrate deploy/diff и реальные concurrency/restore tests.
- [ ] Cargo unit tests, Anchor SBPF build, validator suite, negative tests всех денежных инструкций.
- [ ] Legacy commit reveal/expiry fixtures, отсутствие зависших выплат после upgrade.
- [ ] LP/energy изменения прошли runtime review; пользовательские minShares/maxSpend/deadline.
- [ ] Docker image build/run, non-root persistent volume, worker smoke.
- [ ] Реальный wallet E2E: prep-mint → craft, transfers/stake/market, wrong network, rejection, timeout.
- [ ] On-chain mint/payout caps, review обходов receipt через unrestricted mint; supply/collateral/fee ledger сверка.
- [ ] Validator: concurrent duplicate receipt, failed mint rollback, pause/authority/canonical mint; bounded/legacy marketplace paths.
- [ ] Историческая сверка version=0 rewards, no-new-ID replay при restore; alert на quarantined и проверка cursor после restart.
- [ ] Координированный upgrade с новым discriminator; rent-budget для постоянных receipt PDA утверждён.
- [ ] Operational key/upgrade authority/treasury governance разделены; incident/key rotation drill.
- [ ] Непротиворечивая taxonomy инструментов и миграция legacy инструментов.
- [ ] Зависимости: закрыты или обоснованно и независимо приняты оставшиеся high advisories.
- [ ] Gitleaks по истории, ротация возможных старых ключей, отсутствие legacy Firebase deploy.
- [ ] DB/RPC/DAS/queue observability, limits, backup/restore, p95 и stress targets утверждены.
- [ ] Внешний аудит и проверка deployed bytecode/config/upgrade authority.
- [ ] Экономика утверждена с эмиссией, sinks, Sybil stress, late-player affordability и ликвидностью.
- [ ] Mainnet canary утверждён владельцем с лимитами и планом аварийной остановки.

## Отдельные проекты, не «галочки»
- [ ] VRF + mandatory settlement + frozen odds; только затем новые packs/forge.
- [ ] Bubblegum V2 cosmetic pilot + DAS/proof negative tests.
- [ ] cNFT custody/market/rental/craft adapter и миграция — без двойного владения.
- [ ] Light compressed state/nullifiers pilot с реальными CU/latency/TCO.
- [ ] Полноценная PostgreSQL schema/data migration для multi-instance production.
