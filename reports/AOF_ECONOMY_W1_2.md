# AOF — продолжение W1 / начало b-09

2026-09-23 · PR [#13](https://github.com/Leo88q/aof/pull/13) ·
ветка `arena/01a0cf4b-aof`. **Не L3/L4, не production approval.**

## A — Исходные факты

Полный предыдущий CI для `02f8223` завершился успешно:
[run 35897321190](https://github.com/Leo88q/aof/actions/runs/35897321190), включая
Anchor/SBF, существующий local-validator suite, frontend, backend/PG и secret scan.
Это дополняет предыдущий отчёт, где эти проверки ещё выполнялись.

Отсутствие hub contract/maximum-target/checker и блокеры devnet/independent audit
не устранены. A–F остаётся предварительной структурой до получения контракта.

## B — Реализовано в этом продолжении

1. **Исправлена частичная выплата lottery prize.** Теперь необходима полная сумма
   выше rent, иначе ошибка без списания и без `claimed=true`. Проверены повторный
   claim, underfunding, overflow получателя, нулевой приз и неверный билет.
2. Выделены используемые реальными handlers integer-примитивы: fee split, progressive
   craft cost, checked reserve-preserving lamport transfer. Они подключены к craft,
   marketplace, auction, offer, craft-order, lottery, resource mint и forge escrow.
   Изменений IDL/account layout нет; отключённые механики не включались.
3. Добавлено 20k fee cases × 6 rates, 20k craft-price cases и 30k payout cases в Rust.
   Расширен validator suite: точные recipe burn/mint deltas, rollback CPI при ошибке
   второго входа/выходного cap; точный возврат auction bid и self-outbid; marketplace
   buyer/seller/rent conservation и distinct-message replay rejection.
4. **`GET /watchtower/economy` → `data.issuanceJournal`**: double-entry flow projection
   для ResourceIssued, суммирование gross per (signature,mint), сверка с SPL net delta,
   quarantine mismatch/missing/invalid sources, idempotent rebuild/replay. Последние
   200 полных транзакций; overflow-safe decimal strings/BigInt, salted player identity.
5. 10k journal property cases; негативные тесты source/cap/number validation,
   duplicate conflicts, privacy, bounded DB query. Добавлены реальные DB integration
   tests в существующий disposable SQLite/PostgreSQL runner.

Технический контракт и ограничения: [AOF_ECONOMIC_INVARIANTS.md](../docs/AOF_ECONOMIC_INVARIANTS.md).

## C — Непринятые вызовы / экономические риски

Все 17 исходных findings остаются в [AOF_FINDINGS.md](AOF_FINDINGS.md): по каждому
есть файл, строка, причина, severity и экономическое последствие. Внешнего rescan
и owner-signed accepted-risk по-прежнему нет; severity не занижена.

Дополнительные открытые границы этого шага:

| Finding / критерий | Файл:строка | Причина непринятия | Severity | Экономическое последствие |
|---|---|---|---|---|
| AOF-LOTTERY-02 | `aof-core/src/instructions/lottery.rs:200` | Исправлен и host-tested; нет seeded legacy-round SVM test и проверки deployed bytecode | high | Старый код мог окончательно потерять невыплаченную часть приза |
| AOF-FORGE-CAP-01 | `aof-core/src/instructions/forge.rs:174` | Legacy expiry re-mints burns без резервирования refund capacity под global cap; новые commits disabled; нужен migration/accounting design | high | При наличии legacy обязательств возврат может превысить cap после другой эмиссии; простой запрет возврата блокирует средства |
| Полное c-07 | `aof-core/src/economics.rs:1`, `tests/aof_core.ts:949` | Helpers + часть SVM путей не доказывают все recipes, legacy forge/lottery/quest double-draw и protocol-wide solvency | high | Нельзя считать все источники/стоки и призы полностью проверенными |
| Полное b-09 | `watchtower/src/issuance-journal.ts:1` | Только issuance flow; wallet/opening balances null, treasury role unattributed, другие механики unmapped | high | Нет полной сверки активов/обязательств и финансового P&L |
| Исторические treasury totals | `watchtower/src/read-model.ts:233` | Legacy issuanceFeesResourceUnits складывает разные ресурсы без единой цены; новый journal этого не делает | medium | Aggregate нельзя трактовать как стоимость treasury или платёжный баланс |
| Live ingestion/подлинность | `watchtower/src/read-model.ts:216` | Journal доверяет первичным индексированным строкам; devnet signature/hub accepted+duplicate не получены | high | Совпадение двух производных от одного источника не является независимым доказательством подлинности |
| W2 rewards/proposals/W3/W4 | [AOF_READINESS.md §C](AOF_READINESS.md#c--непринятые-вызовы-и-риски) | Остальные критерии MAX в этом шаге не реализованы | high | Нет готового безопасного контура cross-game payouts/control/DR |

## D — Проверки

- Локально: 7 exporter suites, 10k journal properties, TypeScript, 6-IDL drift gate,
  source security tripwires; без runtime Prisma engine.
- [Run 35909612132](https://github.com/Leo88q/aof/actions/runs/35909612132), `e7f1223`:
  новые Rust tests и SBF **прошли**; validator: **25 passing / 1 failing**.
  Новые craft/auction сценарии прошли. Ошибка marketplace была в test harness:
  RPC metadata ещё null после подтверждения. Добавлено bounded ожидание и проверка
  executed treasury transfer вместо неточной разности >2^53 JSON balances.
- Первый DB integration запуск выявил module-resolution ошибку вне backend directory.
  `NODE_PATH` для обоих integration scripts исправлен по паттерну exporter tests.
- Исправленный текущий suite направлен в CI. **Этот сохранённый отчёт — snapshot до
  завершения повторного полного CI**, не утверждение о его успехе. Последний статус
  доступен в [PR checks](https://github.com/Leo88q/aof/pull/13/checks).
- Sentio/SolGuard/SLAM, devnet/hub acceptance, custody и DR не выполнялись.

## E — Как принимать и что дальше

1. Требовать зелёного полного CI на текущем коде, включая оба DB integration modes.
2. Проверить seeded SVM tests для lottery/forge legacy state; спроектировать refund
   reservation так, чтобы одновременно не нарушать cap и не терять обязательства.
3. Расширять journal по одной механике с источником, provenance, отрицательными
   тестами, double-entry entries и независимыми observations; не добавлять фиктивные
   balancing adjustments ради `matched`.
4. Добавить opening snapshots, историческое treasury attribution и полный backfill
   перед wallet-balance reconciliation. Затем proposal/custody/live hub acceptance.

## F — Итог

Практическое усиление c-07 и первый read-only b-09 slice выполнены. `dataQuality`
не выше partial, отсутствие балансов — null, отсутствие источников — unavailable.
PR остаётся draft; main не изменён; никакой эмиссии, deploy или authority transfer
в этой сессии не производилось.
