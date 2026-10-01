# Evidence для удаления мёртвого кода (шаг B пункта 12)

Таблица собирается `node scripts/dead-code-evidence.mjs --write`, проверяется `--check`
(`tests/readiness/dead-code-evidence.test.cjs`). Источник списка — `docs/INSTRUCTION_INVENTORY.json`
(статус `disabled-on-chain`): удаление кода обязано сопровождаться обновлением evidence, иначе гейт
падает.

| Instruction | Handler behavior | Backend call sites | Frontend call sites | Tests | Admin/security need | Decision |
|---|---|---|---|---|---|---|
| `aof_core.marketplace_buy` | err! FeatureDisabled | — | — | tests/aof_core.ts, tests/readiness/dead-code-evidence.test.cjs, tests/readiness/instruction-inventory.test.cjs | нет | remove — заменена активной marketplace_buy_bounded |
| `aof_core.purchase_season_pass` | require!(false) SeasonPremiumRequired | — | — | tests/aof_extended.ts, tests/readiness/dead-code-evidence.test.cjs | нет | keep — не доказано мёртвой: Покупка платного сезонного пропуска — отключена (SeasonPremiumRequired) до приёмочного гейта 42 дня / 0.15 SOL. |
| `aof_core.rental_start` | err! FeatureDisabled | — | — | tests/aof_core.ts, tests/readiness/dead-code-evidence.test.cjs, tests/readiness/instruction-inventory.test.cjs, tests/readiness/security-checklist.test.cjs | нет | remove — заменена активной rental_start_bounded |
| `aof_quests.achievement_unlock` | err! FeatureDisabled | 1 call(s): aof_backend/src/routes/quests.ts | — | tests/readiness/dead-code-evidence.test.cjs | нет | keep — не доказано мёртвой: Отключена: нельзя самозаявлять достижение без критериев и доверенного верификатора. |
| `aof_quests.challenge_contribute` | err! FeatureDisabled | 1 call(s): aof_backend/src/routes/challenges.ts | — | tests/readiness/dead-code-evidence.test.cjs | нет | keep — не доказано мёртвой: Отключена: нет дебета канонического mint медалей и пути расчёта; ждёт экономической спецификации. |
| `aof_quests.drum_commit` | require!(false) Paused | — | — | tests/readiness/devnet-release-guards.test.cjs, tests/readiness/security-checklist.test.cjs, tests/readiness/vrf-tx-size.test.cjs | нет | keep — не доказано мёртвой: Отключена (Paused): константы — сырые атомы, а не 5 целых единиц проверенного Potato-mint. |
| `aof_quests.potato_spin_commit` | require!(false) FeatureDisabled | — | — | tests/readiness/dead-code-evidence.test.cjs | нет | keep — не доказано мёртвой: Отключена до подписанного devnet-прогона, VRF-смоков и независимого одобрения релиза. |
| `aof_session_keys.session_check_and_spend` | require!(false) AtomicBindingRequired | — | — | — | нет | keep — не доказано мёртвой: Отключена (AtomicBindingRequired): резервирование не привязано к целевой инструкции в одной транзакции. |
| `aof_session_keys.session_create` | require!(false) AtomicBindingRequired | — | — | tests/readiness/dead-code-evidence.test.cjs | нет | keep — не доказано мёртвой: Отключена (AtomicBindingRequired): сессию нельзя выдавать, пока нет атомарной привязки к тратам. |

## Группировка по коммитам (порядок владельца, только доказанно мёртвое)

### `refactor: remove disabled legacy tool market paths`

* `aof_core.marketplace_buy` — remove — заменена активной marketplace_buy_bounded
* `aof_core.rental_start` — remove — заменена активной rental_start_bounded

## Что удаляется вертикальным срезом

Для каждой инструкции: Rust handler, `#[derive(Accounts)]`-контекст, состояние (если больше не
используется), событие/ошибка, IDL-entry, backend-route, frontend-caller, тесты, активные docs.
Сгенерированный IDL обновляется вручную как временное отражение (Anchor недоступен), с обязательной
пометкой pending `anchor build` + `git diff` на Mac/CI.

