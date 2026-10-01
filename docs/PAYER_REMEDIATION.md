# Payer remediation — план коммитов 4–6 (пункт 10)

Правило владельца: **любой live player-specific аккаунт оплачивает игрок**. Проект платит только за
deployment, глобальный `Config`, глобальные реестры, treasury/vault/pool-инфраструктуру,
emergency/security-аккаунты и admin-синглтоны. Gasless-онбординг не добавляем; service/cranker может
авансировать rent только при доказанном возмещении из user-prepaid escrow, с capped fee и возвратом
остатка.

Матрица и гейт: `docs/PAYER_MATRIX.md`, `security/payer-policy.json`, `scripts/payer-audit.mjs`.
Статический инвентарь: **89 init-аккаунтов, `payer-audit debt=0`**. Это не acceptance: по учёту
владельца остаются **5 live payer debts open** до Anchor build, validator и lamport-delta-проверок.
Все правки — source-level; статус «source-aligned manually; generated validation pending».

Этот документ — обязательная спецификация следующих трёх коммитов: каждая правка перечисляет, что
именно меняется в коде, что это делает с IDL и что обязано быть проверено. Все изменения контекстов
Anchors — **pending validation**: без `anchor build` и validator-прогона они не считаются принятыми.

## Долг 1–2: профиль игрока в операторских выдачах

**Исходный debt (до source remediation):** `aof-core/src/lib.rs:552` (`MintResource.player`) и
`aof-core/src/lib.rs:596` (`MintResourceOnce.player`) имели `init_if_needed, payer = authority`, seeds
`[PLAYER_SEED, token_account.owner]`.

**Почему долг:** rent профиля игрока платит кошелёк оператора, хотя `Player` — аккаунт игрока.

**Правка (коммит 4):** убрать создание профиля из операторской выдачи.

* `player: Option<Account<'info, Player>>` с теми же seeds/bump (Anchor поддерживает optional
  аккаунты; PDA, если передан, обязан совпасть).
* `execute_mint` принимает `Option<&mut Player>`: при `None` берутся базовые перки
  (`MINT_FEE_BASE_*`) и профиль не пишется; при `Some` — как сейчас (`has_medallion` /
  `has_historian`). Ветка «инициализировать профиль нулём» удаляется целиком.
* Профиль создаётся действием игрока: это уже делают player-funded пути
  (`init_if_needed, payer = user`, например `start_mining`, `aof-core/src/lib.rs:1089`).

**IDL/клиенты:** `player` перестаёт быть обязательным. Backend (`admin.ts:266`, `admin.ts:432`,
`admin.ts:516`, `resources.ts:75`, `inbox.ts:215`) обязан передавать
`playerPda(owner)` когда профиль существует, иначе program id как placeholder optional-аккаунта.

**Тест:** выдача награды кошельку без профиля не создаёт `Player`; lamports authority не меняются;
после действия игрока профиль появляется и платит за него игрок.

## Долг 3: чек награды

**Где:** `aof-core/src/lib.rs:608` (`MintResourceOnce.reward_receipt`, `init, payer = authority`),
вызов — `aof_backend/src/routes/inbox.ts:215` (backend-only `authorityOnly`).

**Почему долг:** `RewardReceipt` — доказательство игрока, а платит проект; и вся награда сейчас
выдаётся без подписи игрока.

**Правка (коммит 5):** награды становятся claim'ом игрока.

* `MintResourceOnce` получает `player: Signer<'info>` (игрок = получатель
  `token_account.owner`), `reward_receipt` и `player` — с `payer = player`.
* Authority остаётся авторизацией: backend собирает **частично подписанную** транзакцию строго
  фиксированной формы, сообщение содержит quote (kind, amount, mint, reward_id, expiry,
  получатель), игрок проверяет message и подписывает как payer; подпись authority не должна
  разрешать другую транзакцию (никаких wildcard-аккаунтов).
* Пока клиентская часть не готова, долг не считается закрытым: гейт `payer-audit` обязан оставаться
  красным по этому пункту, а не получать исключение.

**Тест:** claim без подписи игрока отклоняется; с подписью — receipt и профиль оплачивает игрок,
lamports authority не меняются; повторный claim того же `reward_id` падает.

## Долг 4: `ToolData` при минте инструмента

**Исходный debt (до source remediation):** `aof-core/src/lib.rs` (`MintTool.tool_data`, тогда
`init_if_needed, payer = authority`); получатель был `recipient: UncheckedAccount` без подписи.

**Почему долг:** `ToolData` — собственность получателя, но получатель не подписант, а rent платит
authority.

**Правка (коммит 4):**

* новый аккаунт `payer: Signer<'info>`; `tool_data` — `init_if_needed, payer = payer`;
* `recipient.key() != authority.key()` и `payer.key() != authority.key()`; ATA обязан принадлежать
  `recipient`. Authority только авторизует минт и никогда не платит rent/fee и не получает инструмент;
* **player self-mint** выбирает `payer == recipient`, поэтому игрок подписывает и оплачивает
  собственный mint/ATA/ToolData. Для **operator-authorized/prepaid mint** payer может отличаться от
  recipient, но обязан быть отдельным подписантом/плательщиком и отличаться от authority. Backend
  self-service маршрут продолжает выбирать `payer = recipient = player`; любой будущий distinct-payer
  маршрут обязан явно связать подписанта, quote и получателя. Нельзя навязывать равенство payer и
  recipient в on-chain constraint.

**IDL/клиенты:** +1 signer; backend (`tools.ts`, admin-роуты test grant) передаёт игрока как payer в
self-mint/test-grant-пути вместо `AUTHORITY_PUBKEY`; frontend builder проверяет authority ≠ player.

**Тест:** проверки допускают operator/prepaid payer, отличный от recipient; отклоняют authority как
payer или recipient; player self-mint использует `payer == recipient`. Anchor lamport-delta proof
остаётся pending.

## Долг 5: сезонный пропуск

**Где:** `GrantSeasonXp.season_pass` — `init_if_needed, payer = authority`; backend —
`aof_backend/src/routes/season.ts:55`.

**Почему долг:** платный пропуск (`PurchaseSeasonPass`, `payer = user`) бесплатно создаётся за счёт
оператора.

**Правка (коммит 5):** разнести две операции.

* `init_season_pass` — новая инструкция: `player: Signer` (payer), создаёт `SeasonPass`; player-funded.
* `grant_season_xp` — authority меняет **только существующий** пропуск; при отсутствии — понятная
  ошибка (`SeasonPassNotInitialized`), `init_if_needed` уходит.
* Альтернатива, если игрок не должен делать отдельную транзакцию: entitlement/voucher → player claim.

**Тест:** `grant_season_xp` без пропуска даёт понятную ошибку; `init_season_pass` платит игрок;
lamports authority не уменьшаются при обычном действии игрока.

## Коммит 6: backend перестаёт оплачивать ATA игрока

**Где:** `aof_backend/src/routes/resources.ts:92-95`, `inbox.ts:206-215` и `233-236`,
`admin.ts:258-261`, `408-418`, `506-509`, `581`, `hotMarket.ts:109-110`.

**Правка:** убрать `createAssociatedTokenAccountIdempotentInstruction(AUTHORITY_PUBKEY, ...)` для
пользовательских ATA из операторских сборок. Создание ATA идёт **в message транзакции игрока**,
payer = кошелёк игрока, подписывает игрок; backend authority подписывает только authorization-
инструкции и не передаёт свой ключ. Создание ленивое/идемпотентное; quote не включает rent уже
существующего ATA; асинхронные награды — через player claim.

**Тест:** ATA отсутствует → транзакция создаёт его, lamports списаны с игрока, lamports authority не
изменились; повторный вызов с существующим ATA не платит за него второй раз.

## Прогресс

**Коммит 4 (player-funded player-owned accounts) — исходники готовы, помечены pending compilation.**

* `MintResource.player`: `init_if_needed, payer = authority` убран. Поле стало
  `UncheckedAccount` под seeds-констрейнтом (аккаунта может ещё не быть), handler читает его
  через `read_optional_player` и передаёт в `execute_mint` как `Option<&Player>`; ветка
  «инициализировать профиль нулём» удалена. Профиль создаётся действием игрока.
  Эта запись ушла из `security/payer-policy.json` вместе с долгом: гейт теперь ловит
  попытку вернуть `init_if_needed` (тест «запись для аккаунта, который больше не создаётся»).
* `MintTool.tool_data`: добавлен `payer: Signer` сразу после `recipient`, `init_if_needed, payer = payer`;
  authority запрещён как payer и recipient, но payer может отличаться от recipient. Self-mint и текущий
  test-grant выбирают payer = recipient; отдельный payer разрешён для operator-authorized/prepaid flow.
  `security/instruction-roles.json` не меняется (роли инструкции те же), а `docs/INSTRUCTION_INVENTORY`
  перегенерирован.
* Backend: `routes/tools.ts` (`POST /tools/mint`) возвращает `{ tx }` — fee payer и подписант
  получатель, ATA получателя создаётся в его же транзакции; `routes/admin.ts`
  (`POST /test-grant-tools`) собирает mint-аккаунт, ATA и `ToolData` со счёта получателя и
  подписывает частично (`coSign(instructions, recipient, mintKeypairs)`), authority добавляет
  только авторизацию.
* Frontend: добавлен локальный интент `toolMint` (`frontend/src/lib/transactionIntent.ts`) —
  кошелёк принимает только один `mint_tool` на свой ATA со своим `ToolData`, ровно одно
  идемпотентное создание ATA, точный тип/редкость инструмента из payload; в транзакции
  разрешены две подписи (игрок + authority). Генератор таблицы инструкций больше не помечает
  `mint_tool` как authority-only.
* Тесты: readiness проверяет Rust-контекст, backend-роуты, IDL/таблицу, отдельного payer и
  обязательный `toolMint` intent. Anchor helper-вызовы явно ставят `tx.feePayer` в designated payer.
  `tests/aof_payer_funding.ts` теперь использует инициализированные SPL tool mints, configured resource
  mint и treasury ATA; создаёт валидный стейк для `start_mining` и отдельно проверяет отсутствие payer
  signature. Всё ещё pending Anchor/validator execution.
* `payer-audit` source inventory классифицирует 89 init-аккаунтов и сообщает 0 debt-строк; readiness
  явно фиксирует, что это не закрывает **5 owner-tracked live debts**. Regression «скрытая субсидия»
  вводит нарушение в код временной копии, а не в policy.
* После этих правок статический inventory может показывать `payer-audit debt=0`, но owner-tracked
  acceptance остаётся **5 live debts open** (те же пять пунктов в `docs/PAYER_AUDIT.md`). Это не
  противоречие: source gate не доказывает generated IDL и validator/lamport deltas. `MintResourceOnce.player`
  перенесён из коммита 4 в коммит 5: его исправляет та же подпись игрока, что и чек награды, и дробить
  один контекст на два коммита значило бы дважды переписывать один вертикальный срез.

**Что осталось до закрытия пункта 10:** только внешняя валидация — `anchor build`,
`anchor test --skip-build` (10 payer acceptance-тестов `tests/aof_payer_funding.ts` и
обновлённые `tests/aof_core.ts`/`tests/aof_extended.ts`), затем отчёт из 10 пунктов (уже
написан в теле PR #32) можно считать подтверждённым кодом.

**Коммит 5 (player-claimed rewards and season initialization) — исходники готовы, pending compilation.**

* `MintResourceOnce`: добавлен `payer: Signer` с констрейнтом `payer.key() == token_account.owner`;
  `player` (профиль) и `reward_receipt` теперь `payer = player` — чек награды и профиль игрока
  оплачивает получатель, authority только авторизует минт.
* `GrantSeasonXp`: `init_if_needed, payer = authority` удалён, добавлены констрейнты
  `season_pass.owner == user` и `season_id == season.season_id`, а handler требует существующий
  пропуск (`AofError::SeasonPassNotInitialized`, вариант добавлен в конец enum, чтобы не сдвигать коды).
* Новая инструкция `InitSeasonPass` (`player: Signer`, `init, payer = player`) + событие
  `SeasonPassInitialized`; `PurchaseSeasonPass` остаётся апгрейдом существующего пропуска.
* Backend: `/inbox/claim` строит частично подписанную транзакцию (`payer: ownerPk`,
  `coSign([createUserAta, ix], ownerPk)`), ATA казны оплачивает проект отдельно и только если её нет,
  а подтверждение приходит в новый `/inbox/claim/confirm` — по on-chain `RewardReceipt`, не по словам
  клиента. Повторный claim до подписи выдаёт свежую транзакцию (иначе истёкший блокхаш навсегда
  блокировал бы награду); от двойной выплаты защищает сам чек.
* Backend: `/season/xp/grant` проверяет существование пропуска и возвращает
  `409 SEASON_PASS_NOT_INITIALIZED`; новый `/season/pass/init` отдаёт игроку `{ tx }` (authority не нужен).
* Frontend: интенты `rewardClaim` и `seasonPassInit` (точные аккаунты, сумма, вид ресурса, reward_id,
  сезон), `api.inbox.confirmClaim`, `api.season.passInit`, двухшаговый claim в `InboxHome`.
* Тесты: `tests/readiness/payer-reward-claim.test.cjs` (7); обновлены валидаторные
  `tests/aof_core.ts` (payer + подпись игрока, дельта lamports) и `tests/aof_extended.ts`
  (`init_season_pass`, `SeasonPassNotInitialized`); добавлен `tests/aof_payer_funding.ts` —
  10 приёмочных payer-тестов (8 и 9 помечены skip: нужен VRF-стенд и warp окна refund; те же
  свойства уже проверяются в `tests/aof_vrf_localnet.ts`).
* Статический `payer-audit` может сообщать **0** (раньше распознавал 5 debt-строк), но owner-tracked
  acceptance по-прежнему **5 live debts open**; ни источник, ни readiness не закрывают их без Anchor /
  validator proof. Отдельно остаётся проверка backend ATA-flow (`resources.ts`, `admin.ts`, `hotMarket.ts`)
  через `tests/readiness/ata-funding.test.cjs`; она также не доказывает реальные lamport deltas.

**Коммит 6 (backend перестаёт оплачивать ATA игрока) — исходники готовы, pending compilation.**

* `resources.ts` (`/mint`), `admin.ts` (`/mint-resource`, `/test-grant`, `/test-grant-mind`):
  ATA игрока создаётся в его транзакции (`payer = игрок`), транзакция возвращается как `{ tx }`
  (для батча `/test-grant` — `{ txs }`) и подписывается кошельком игрока; authority добавляет
  только авторизацию минта.
* ATA казны/пула остаются инфраструктурой проекта: создаются отдельной `authorityOnly`
  транзакцией и только если аккаунта ещё нет (`hotMarket.ts` init pool — пул и казна, это не
  субсидия игроку).
* Клиент: страница сезонного пропуска получила кнопку бесплатной ветки — она отправляет игрока в
  `/season/pass/init` и подписывает `{ tx }` по интенту `seasonPassInit`.
* Тесты: `tests/readiness/ata-funding.test.cjs` (9) — полный разбор создателей ATA в бэкенде,
  точный allowlist инфраструктуры, проверка каждого роута и клиентской проводки.

## Payer acceptance tests (обязательный минимум, 10)

1. игрок платит за `Player`/профиль; 2. игрок платит за `ToolData`; 3. игрок платит за
`init_season_pass`; 4. игрок платит за свой ATA; 5. authority авторизует, но не финансирует;
6. reward claim требует подписи игрока; 7. отсутствие подписи игрока отклоняется; 8. prepaid
возмещение capped; 9. остаток escrow возвращается игроку; 10. баланс authority не уменьшается при
обычном действии игрока.

## Порядок и статус

Коммиты: **4** — player-funded аккаунты (долги 1, 2, 4); **5** — player-claimed награды и сезон
(долги 3, 5); **6** — отказ backend от оплаты чужих ATA. После каждого: регенерация IDL скриптами,
`check-idl-drift.py`, `payer-audit --write/--check`, readiness, обновление `docs/PAYER_AUDIT.md` и
`docs/PAYER_MATRIX.*`. `payer-audit` освобождается от долга только вместе с кодом и тестом; baseline-
списка исключений у гейта нет.

Не проверено в песочнице: Rust/Anchor-компиляция, `anchor build`, validator, layout-тесты — на Mac/CI.
