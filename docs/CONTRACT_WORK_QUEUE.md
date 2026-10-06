# Очередь работ по контракту (активный документ)

Статус: 2026-10-06. Документ заменяет ссылки на `docs/UNBLOCK_PLAN_2026-09-30.md`
(он помечен `HISTORICAL` и в нём нет раздела §3.8, на который ссылался зонд).
Здесь только то, что **нельзя включить тумблером**: нужна правка программы,
сборка, деплой и проверка. Каждая запись говорит, что именно осталось, чем это
доказано в коде и как проверить результат — без «должно работать».

Нумерация разделов сохранена от исторического плана, чтобы ссылки в зонде,
бэкенде и скриптах оставались узнаваемыми.

## §3.1 Ордербук v2, §3.2 потолок цены в лотерее, §3.4 перерождение, §3.5 горячий рынок

Код в ветке, механики закрыты только **отсутствием новой сборки** `aof_core` /
`aof_market` в сети. Доказательство, что дело именно в деплое: инструкции
(`place_buy_order_v2`, `place_sell_order_v2`, `cancel_buy_order_v2`,
`cancel_sell_order_v2`, `match_resource_orders_v2`, `buy_lottery_ticket(max_price)`,
`reset_for_rebirth`, `transfer_tool`) есть в `aof_backend/src/idl/aof_core.json`,
а строки зонда `scripts/devnet-program-probe.py` для них читаются из IDL
репозитория. Что сделать: `UPGRADE=aof_core,aof_market PROGRAM_MAX_LEN_POLICY=exact
AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply` (`UPGRADE` нужен потому,
что `aof_core`/`aof_market` уже развёрнуты: без него деплой честно пропускает
существующий аккаунт, и новый байткод не уезжает), затем проверить байткод
(см. «Проверка деплоя» ниже).

## §3.3 Сессионные ключи: единственная механика, закрытая в коде

`session_create` и `session_check_and_spend` отвечают `SkError::AtomicBindingRequired`
(`programs/aof-session-keys/src/lib.rs`), пока резерв дневного лимита не привязан
к целевой инструкции атомарно: иначе бот тратит лимит, действие может не
выполниться, и «резерв» становится фикцией.

Что осталось сделать (это привязка, а не тумблер):

1. Резерв и действие — одна транзакция: целевая программа (`aof_core` /
   `aof_market`) получает `session` (PDA `[SESSION_SEED, authority]`),
   `session_signer` и вызывает `session_check_and_spend` через CPI **внутри**
   своего обработчика, до изменения состояния.
2. `session.target_program` обязан совпадать с программой, которая делает CPI,
   плюс проверка бита `allowed_ixs` по дискриминатору инструкции; биты 60–63
   запрещены (`FORBIDDEN_IXS_MASK`).
3. Лимиты: `max_amount_per_tx` из `TrustSnapshot` при создании
   (`tier_daily_cap_lamports`), дневной потолок 1000×, `day_start` /
   `spent_today` сбрасываются тем же обработчиком.
4. Проверки, без которых пункт не закрывается: чужой подписант, просроченная
   сессия, отозванная/приостановленная сессия, чужой target program, значение
   больше лимита, повторное использование подписанта на другую программу,
   запрещённый бит.

После реализации: снять `require!(false, ...)`, добавить гейт «сессия
расходуется только вместе с целевой инструкцией», обновить маршруты `/session/*`
(сейчас 503) и запись `SESSION_KEYS_DISABLED_UNTIL_ATOMIC_TARGET_BINDING`.

## §3.6 Сезонный пропуск: платный трек (source implementation; sale gate closed)

Source path uses the existing `SeasonPass` layout and a separate
`SeasonPremiumClaims` ledger:

* `purchase_season_pass` retains the 42-day, duplicate-purchase, price, and
  premium-ledger logic, but starts with an on-chain fail-closed
  `SeasonPremiumRequired` guard **before any SOL transfer**. This blocks direct
  RPC purchases as well as HTTP sales until the acceptance gate is complete.
  The HTTP middleware also rejects unless `PAID_PASS_SALES_ENABLED=true`, and
  the frontend keeps `PAID_PASS_READY=false`.
* The old `claim_season_reward(level, premium_track)` ABI serves only the free
  ledger; premium requests through it fail. The separate
  `claim_premium_season_reward(level)` checks the premium flag and independent
  bitmap, then mints the existing per-level CIRCUIT amount through `IssuanceCap`.
  Both tracks require XP and each can claim a level at most once. The new account,
  event, and appended instruction entries remain in the hand-maintained IDL and
  layout baseline.
* Reward claims use a wallet proof to authenticate player intent. The backend
  authority submits the claim and pays the transaction fee and any recipient ATA
  rent. The UI has no player-paid claim quote/sign flow and keeps ambiguous
  outcomes pending while signature/claim status is checked.
* XP entitlements remain individually signed, replay-protected and player-funded
  through the existing `grant_season_xp` path. VIP styling is still cosmetic;
  it does not change yields or rewards.

**Release status:** paid-pass sales remain closed; the on-chain guard and
`PAID_PASS_READY=false` stay in place until the separate Devnet acceptance gate
passes. No build/deploy/RPC/smoke or live purchase was performed in this
code-only session. Before changing the gate or describing the feature as ready,
run the pinned Mac toolchain and purchase/free-track/premium-track/duplicate/
expiry/quote smoke tests against verified matching bytecode. The separate
premium bitmap enables independent claims; it does not mean that paid sales or
acceptance have been enabled.

## §3.7 MIND

Отдельный utility-минт и банк; спины остаются выключенными. Историческая запись
про девнет: `docs/HISTORICAL_MIND_DEVNET_SETUP.md` (документ помечен
`HISTORICAL`, активных инструкций там нет).

## §3.8 Фляги, обмен DATA→энергия, награда за «лук»

Три механики, у которых разная судьба. Две **реализованы в коде** и ждут деплоя
`aof_core`, третья **снята навсегда**, потому что предмета больше нет.

### §3.8.1 Обмен DATA → энергия: сделано в коде, ждёт деплоя

* Программа: `exchange_data_energy(data_amount: u64)` —
  `aof-core/src/instructions/exchange_data_energy.rs`.
  Сжигает `data_amount` атомов DATA и начисляет
  `data_amount / DATA_ATOMS_PER_ENERGY` единиц энергии, где
  `DATA_ATOMS_PER_ENERGY = RESOURCE_UNIT` (1 целый DATA → 1 энергия),
  `ENERGY_CAP = 20`.
* Границы: `data_amount` обязан быть целым числом единиц (`InvalidAmount` —
  иначе дробная часть сгорела бы впустую); обмен отказывает
  (`EnergyCapExceeded`), если энергия не влезет в бак целиком, — сжечь DATA «в
  никуда» нельзя; сжигание идёт до начисления, поэтому отказ CPI не оставляет
  ни энергии, ни потерянных токенов.
* Аккаунт энергии — ленивый (`init_if_needed`, seed `energy_account`), как во
  всех лабораторных инструкциях: новый аккаунт создаётся полным.
* Бэкенд: `POST /resources/exchange-energy`, тело — `user` и `dataAmount` в
  целых DATA (в атомы переводит бэкенд). Минт берётся из `Config.dataMint` и
  проверяется на каноничность
  (`validateSingleCanonicalResourceMint`) **до** сборки транзакции; маршрут идёт
  через `requireCircuitOpen` и лимит кошелька.
* Почему это нужно: энергия тратится лабораторной цепочкой (`plant_neuron`,
  `harvest_synapse`, `start_signal_processing`, `start_model_training`), а
  восстанавливалась только временем (1 за 30 минут); у DATA не было ни одного
  стока. Теперь DATA — топливо, а сжигание освобождает потолок выпуска.

### §3.8.2 Применение фляги: сделано в коде, ждёт деплоя

* Программа: `use_flask(flask_kind: u8)` —
  `aof-core/src/instructions/use_flask.rs`. Сжигает одну флягу (1 целый флюид) и
  возвращает энергию по тиру: `FLASK_ENERGY_GAIN = [5, 5, 8, 10, 20]` для
  `CryoFluid`, `VoltFluid`, `BioFluid`, `NanoFluid`, `QuantumFluid`
  (тип 1..5). Лестница не убывает, верхний тир закрывает бак целиком.
* Каноничность: `flask_kind` строго 1..=5 (`InvalidFlaskType`), минт сверяется с
  `mint_for_kind` из `MaterialMints` (`MaterialNotRegistered`) до сжигания;
  бак обязан вместить всю награду (`EnergyCapExceeded`).
* Бэкенд: `POST /tools/use-flask`, тело — `user` и `flaskType` 1..5. Минт флюида
  берётся из `MaterialMints` (поле через `materialMintField`), проверяется тем же
  одиночным валидатором; маршрут идёт через `requireCircuitOpen`, лимит кошелька
  и карту wallet-proof (`tools_use_flask`).
* Что это **не** обещает: баффов «+20% добычи», «×2 скорости», «+100 газа» — под
  них в программе нет состояния, и каталог фляг (`marketDetailCopy`) теперь
  говорит ровно то, что делает инструкция. Обещание эффекта без инструкции —
  это ложь игроку, а не «план».

### §3.8.3 Награда за «лук»: снято навсегда

«Лук» и скины — доребрендовая механика Age of Farming. В текущей программе:

* нет `SkinAccount` и seeds `skin` (поиск по `aof-core/src` и `programs/*/src`
  не находит ни одного употребления);
* `bow` встречается один раз — в списке старых имён инструментов, которые
  миграция переименовывает в инструменты (`aof-core/src/state.rs`,
  `canonical_tool_type`);
* инструкций `bow_reward_commit` / `bow_reward_reveal` нет ни в коде, ни в IDL, и
  писать их не будут.

Поэтому маршруты `POST /forge/bow/commit|reveal` отвечают **410** с кодом
`BOW_REWARD_ROUTE_RETIRED_LEGACY_ITEM` (объяснение есть в `apiErrorCopy` на семи
языках), хелперы `bowCommitPda`/`skinPda` удалены, из карт wallet-proof и из
клиентского API вызовы убраны, а строка «Награда за лук» исчезла из зонда:
механики нет — значит, и строки быть не должно. Скины заменены обычными
NFT-инструментами, передача владения — `transfer_tool`, награда за попытку
крафта — `forge_attempt_*`.

## Что ещё не сделано в §3.8 (честно)

* **UI нет.** Маршруты `/resources/exchange-energy` и `/tools/use-flask` готовы к
  вызову, но панелей, из которых игрок их вызывает, в интерфейсе пока нет:
  `/energy/balance/:user` читает `EnergyAccount`, а экрана «пополнить энергию»
  нет. Это следующий шаг, и он не требует правок контракта.
* **Версия байткода не подтверждена**, пока не прошла проверка ниже. Строка
  зонда для этих механик печатает `ждёт деплоя` — из одного лишь IDL репозитория
  «включено» не выводится.

## Проверка деплоя (обязательная часть, а не формальность)

```sh
# 1) сборка и деплой (ключи программ — на машине владельца)
PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply

# 1б) уже развёрнутые программы: без UPGRADE деплой их пропускает, а новый код
#     (например, §3.8 use_flask/exchange_data_energy) остаётся только в репозитории.
#     Скрипт сам сверяет байткод в сети с локальным .so и обновляет только отличающееся.
UPGRADE=aof_core PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply

# 1в) если backend не запущен и нужно только доставить байткод — SKIP=backend
#     (или scripts/deploy-devnet.sh --apply): ни Config, ни минты, ни тумблер
#     добычи не трогаются, ADMIN_TOKEN и aof_backend/.env не нужны.
UPGRADE=aof_core SKIP=backend PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet \
  scripts/devnet-bringup.sh --apply
UPGRADE=aof_core PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet \
  scripts/deploy-devnet.sh --apply

# 2) доказательство, что в сети лежит байткод из этого репозитория
scripts/verify-programs.sh devnet <authority-pubkey> target/deploy --require-bytecode

# 3) смоук: маршруты, которые читают Config/MaterialMints, и состояние механик
python3 scripts/devnet-program-probe.py <RPC_URL>
```

Пока шаг 2 не выполнен, утверждение «механика включена» запрещено: наличие
аккаунта программы и совпадение loader'а доказывают только то, что программа
задеплоена, а не то, что её байткод собран из этой ветки.

## Состояния в зонде

| Состояние | Что значит | Что делать |
| --- | --- | --- |
| `включено` | прочитано из аккаунтов сети прямо сейчас | — |
| `ждёт деплоя` | инструкция есть в IDL репозитория; версия байткода в сети не подтверждена | собрать, задеплоить, `verify-programs.sh --require-bytecode` |
| `выключено` | либо не пройден шаг включения, либо механики нет в коде | действие напечатано рядом |
| `нет данных` | RPC не ответил или IDL не читается | проверить RPC/файл |

Логика разбора проверяется офлайн: `python3 scripts/test-devnet-program-probe.py`.
Раздел §3.8 закреплён гейтом `tests/readiness/contract-work-3-8.test.cjs`:
IDL ↔ инструкция ↔ маршрут ↔ wallet-proof ↔ текст для игрока.
