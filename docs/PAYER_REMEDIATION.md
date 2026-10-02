# Payer remediation — план коммитов 4–6 (пункт 10)

Правило владельца: **любой live player-specific аккаунт оплачивает игрок**. Проект платит только за
deployment, глобальный `Config`, глобальные реестры, treasury/vault/pool-инфраструктуру,
emergency/security-аккаунты и admin-синглтоны. Gasless-онбординг не добавляем; service/cranker может
авансировать rent только при доказанном возмещении из user-prepaid escrow, с capped fee и возвратом
остатка.

Матрица и гейт: `docs/PAYER_MATRIX.md`, `security/payer-policy.json`, `scripts/payer-audit.mjs`.
Статический инвентарь: **92 init-аккаунта, `payer-audit debt=0`** (включая отдельный player-funded
`InitPlayer.player_profile` и player-funded SeasonPass/replay cursor при первом XP claim). Это не acceptance:
по учёту владельца остаются **5 live payer debts open**
до Anchor build, validator и lamport-delta-проверок.
Все правки — source-level; статус «source-aligned manually; generated validation pending».

Этот документ — обязательная спецификация следующих трёх коммитов: каждая правка перечисляет, что
именно меняется в коде, что это делает с IDL и что обязано быть проверено. Все изменения контекстов
Anchors — **pending validation**: без `anchor build` и validator-прогона они не считаются принятыми.

## Долг 1–2: профиль игрока в операторских выдачах

**Исходный debt (до source remediation):** `MintResource.player` и `MintResourceOnce.player` создавали
`Player` с `init_if_needed, payer = authority`, seeds `[PLAYER_SEED, token_account.owner]`.

**Почему долг:** rent профиля игрока платил кошелёк оператора, хотя `Player` — аккаунт игрока.

**Физическое исправление (source-level; validator pending):** разделить операторский mint и player claim.

* `MintResource.player` — `UncheckedAccount` под PDA seeds, без `init`/`init_if_needed` и без payer;
  `read_existing_player` требует уже существующий program-owned профиль и сверяет `Player.owner` с
  владельцем recipient ATA. Отсутствующий профиль завершает выдачу `PlayerNotInitialized`.
* Backend `/resources/mint` и admin resource-grant callers вызывают `requireExistingPlayer` и
  передают `playerPda(owner)`; они не создают Player и не оплачивают его rent.
* `InitPlayer` — отдельный `init_player`: `player: Signer`, `init, payer = player`, PDA
  `[PLAYER_SEED, player.key()]`. Игрок явно создаёт и оплачивает собственный профиль.
* `MintResourceOnce` оставляет создание `Player` внутри reward-claim вертикального среза,
  `init_if_needed, payer = payer`, где подписавший payer обязан совпасть с владельцем recipient ATA.

**Тест:** операторская `MintResource` не создаёт профиль; без предварительного player-funded
`init_player` она отклоняется. Reward claim может создать профиль только с подписью и rent игрока;
лампорты authority не уменьшаются. Все эти assertions пока source-level.

## Долг 3: чек награды

**Где:** `aof-core/src/lib.rs:608` (`MintResourceOnce.reward_receipt`, `init, payer = authority`),
вызов — `aof_backend/src/routes/inbox.ts:215` (backend-only `authorityOnly`).

**Почему долг:** `RewardReceipt` — доказательство игрока, а платит проект; и вся награда сейчас
выдаётся без подписи игрока.

**Правка (коммит 5):** награды становятся claim'ом игрока.

* `MintResourceOnce` получает `payer: Signer<'info>` с проверками `payer == token_account.owner`
  и `payer != authority`; `player` (`init_if_needed`) и `reward_receipt` (`init`) имеют `payer = payer`.
* Authority остаётся авторизацией: backend собирает частично подписанную транзакцию и `payerQuote`
  (payer, exact-message SHA-256, network fee, rent, максимальная стоимость и `lastValidBlockHeight`).
  Wallet валидирует quote и инструкцию/аккаунты, показывает стоимость и подписывает именно этот
  payload; без payer signature claim невозможен. Эти проверки source-level, runtime pending.
* Статический `payer-audit=0` означает только согласованность init-policy; он не закрывает owner-tracked
  debt. Ни exception/allowlist для claim, ни acceptance до Anchor build/validator/lamport checks нет.

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

## Долг 5: сезонный пропуск и XP entitlement (player-facing claim)

**Исходный долг:** `GrantSeasonXp.season_pass` создавался как `init_if_needed, payer = authority`; старый
backend route мог оплатить первый SeasonPass за игрока. Этот вариант удалён и не должен возвращаться.

**Текущая правка (2026-10-02; source-level, Anchor/validator pending):** строго ограниченный двухстадийный flow.

* `POST /admin/xp/grant-intent` остаётся за `requireAdmin`: валидирует player, season, amount, campaign,
  TTL, записывает cluster genesis hash, program ID, random entitlement ID и DB monotonic nonce. Он только
  создаёт entitlement; не строит, не подписывает и не отправляет транзакцию.
* Игрок проходит single-use wallet proof на `POST /xp/claims`, затем запрашивает
  `/xp/claims/:id/transaction`. Backend сверяет владельца, cluster/program, expiry, on-chain Season,
  очередность и account state, после чего возвращает exact-message authority-co-signed transaction и
  bounded payer quote. Fee payer — player; authority — read-only signer, никогда не payer.
* On-chain `grant_season_xp` подписывается authority и player. Amount, season, nonce, expiry, campaign
  digest, entitlement ID и genesis digest входят в authority-подписанную инструкцию. `SeasonPass` и один
  `SeasonXpClaimCursor` на player/season используют `init_if_needed, payer = user`; существующие счета
  повторно не получают rent. Replay/expiry отклоняются, XP и cursor обновляются атомарно.
* Frontend SeasonPass page показывает только кошелёк-авторизованные pending claims, «Получить», campaign,
  expiry, live fee/rent quote (rent только для отсутствующих pass/cursor) и total cap. Перед подписью
  local intent проверяет player fee payer, обе подписи, read-only authority, PDAs, account privileges,
  args/digests и live genesis hash/expiry. Campaign/genesis digests повторно вычисляются WebCrypto.
* `/xp/claims/:id/confirm` требует свежий proof и проверяет успешную транзакцию + точный `SeasonXpGranted`
  event; status становится consumed только после подтверждённого settlement. List также сверяет cursor
  для восстановления после потери confirm response. Ошибка/недостаток lamports не потребляет entitlement.
* `init_season_pass` остаётся отдельной player-signer/payer инструкцией. Premium price остаётся закрытой;
  правила rent copy и player-paid initialization не меняются.

**Тесты:** `tests/aof_payer_funding.ts` и `tests/aof_extended.ts` покрывают player/authority balances,
player signer/payer, first and repeated rent, tampered amount signature, expiry, replay, atomic insufficient
funds и concurrent double claim. Readiness проверяет admin gate, wallet-proof mapping, exact intent,
cluster binding, generated IDL/client и UI. Все Rust/Anchor runtime проверки остаются pending в этой среде.

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

* `MintResource.player`: `init_if_needed, payer = authority` убран. Поле — `UncheckedAccount` под
  PDA seeds без init; `read_existing_player` требует program-owned Player и проверяет его owner.
  Backend `/resources/mint` и admin resource-grant callers требуют существующий профиль.
* `InitPlayer.player_profile`: выделена отдельная `init_player` с `player: Signer` и `init, payer = player`;
  новый профиль оплачивает игрок. Его обязательная policy-классификация входит в static inventory.
  Попытка вернуть init в `MintResource` или удалить `InitPlayer` из payer policy должна ронять gates.
* `MintTool.tool_data`: добавлен `payer: Signer` сразу после `recipient`, `init_if_needed, payer = payer`;
  authority запрещён как payer и recipient, но payer может отличаться от recipient. Self-mint и текущий
  test-grant выбирают payer = recipient; отдельный payer разрешён для operator-authorized/prepaid flow.
  `security/instruction-roles.json` не меняется (роли инструкции те же), а `docs/INSTRUCTION_INVENTORY`
  перегенерирован.
* Backend: `routes/tools.ts` (`POST /tools/mint`) и `routes/admin.ts` (`POST /test-grant-tools`)
  возвращают частично подписанную player-paid транзакцию вместе с `payerQuote`. ATA получателя,
  mint-аккаунт и `ToolData` оплачивает выбранный non-authority payer; self-service/test-grant выбирают
  payer = recipient. Authority добавляет только требуемую authorization-подпись.
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
* `payer-audit` source inventory классифицирует 90 init-аккаунтов (включая `InitPlayer.player_profile`)
  и сообщает 0 debt-строк; readiness явно фиксирует, что это не закрывает **5 owner-tracked live debts**.
  Regression «скрытая субсидия» вводит нарушение в код временной копии, а не в policy.
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
* Исторический update-only вариант для `GrantSeasonXp` впоследствии заменён на player-facing
  entitlement claim: текущий контекст требует authority + user signers, `payer = user` для pass/cursor,
  expiry и monotonic replay cursor. Первый XP claim создаёт отсутствующий pass за счёт игрока.
  `SeasonPassNotInitialized` оставлен в error enum/IDL для стабильности кодов, но active handler его не возвращает.
* Новая инструкция `InitSeasonPass` (`player: Signer`, `init, payer = player`) + событие
  `SeasonPassInitialized`; `PurchaseSeasonPass` остаётся апгрейдом существующего пропуска.
* Backend: `/inbox/claim` строит частично подписанную транзакцию с `payer: ownerPk`, exact-message
  `payerQuote` (network fee/rent/max-cost/expiry) и проверенным `RewardReceipt` confirm flow.
  ATA казны оплачивает проект отдельно и только если её нет. Повторный запрос до подписи получает
  свежий blockhash/quote; от двойной выплаты защищает on-chain `init` receipt.
* Backend: старый `/season/xp/grant` удалён. Текущий `/admin/xp/grant-intent` — только admin entitlement;
  `/xp/claims` и дочерние POST routes требуют single-use player wallet proof, а transaction builder
  возвращает player-paid authority co-sign. Confirm валидирует event, cursor восстанавливает потерянный
  confirm, consumed записывается только после settlement. `/season/pass/init` остаётся отдельной
  player-paid инструкцией, quote/rent только для отсутствующего PDA.
* Frontend: интенты `rewardClaim`, `seasonPassInit`, `seasonXpClaim`; `SeasonPassPage` отображает pending XP,
  campaign/expiry/live rent-fee quote, подписывает точную authority-signed transaction и подтверждает claim.
* Тесты: `tests/readiness/payer-reward-claim.test.cjs` обновлён; `tests/aof_extended.ts` и
  `tests/aof_payer_funding.ts` покрывают signer/payer/rent/replay/expiry/tamper/atomicity/concurrency;
  suite содержит 10 payer acceptance cases. Они не запускались в sandbox: Anchor/validator pending.
* Статический `payer-audit` может сообщать **0** (раньше распознавал 5 debt-строк), но owner-tracked
  acceptance по-прежнему **5 live debts open**; ни источник, ни readiness не закрывают их без Anchor /
  validator proof. Отдельно остаётся проверка backend ATA-flow (`resources.ts`, `admin.ts`, `hotMarket.ts`)
  через `tests/readiness/ata-funding.test.cjs`; она также не доказывает реальные lamport deltas.

**Коммит 6 (backend перестаёт оплачивать ATA игрока) — исходники готовы, pending compilation.**

* `resources.ts` (`/mint`), `admin.ts` (`/mint-resource`, `/test-grant`, `/test-grant-mind`):
  ATA игрока создаётся в его транзакции (`payer = игрок`); ответ содержит `tx`/`txs` вместе с
  transaction-bound `payerQuote`, который игрок проверяет перед подписью. Authority добавляет только
  авторизацию минта и отдельно создаёт инфраструктурную ATA казны при её отсутствии.
* ATA казны/пула остаются инфраструктурой проекта: создаются отдельной `authorityOnly`
  транзакцией и только если аккаунта ещё нет (`hotMarket.ts` init pool — пул и казна, это не
  субсидия игроку).
* Клиент: страница сезонного пропуска получила кнопку бесплатной ветки — она отправляет игрока в
  `/season/pass/init` и подписывает `{ tx }` по интенту `seasonPassInit`.
* Тесты: `tests/readiness/ata-funding.test.cjs` (9) — полный разбор создателей ATA в бэкенде,
  точный allowlist инфраструктуры, проверка каждого роута и клиентской проводки.

## Payer acceptance tests (10 direct payer cases + async VRF cases)

`tests/aof_payer_funding.ts` checks: (1) `InitPlayer` rent and fail-closed `MintResource`; (2)
player-funded `ToolData`; (3) wrong-recipient `MintTool` atomicity; (4) player-funded
`init_season_pass` plus update-only `GrantSeasonXp`; (5) first ATA rent and existing-account fee-only
delta; (6) authority co-signs but missing payer signature fails; (7) claim pays for `Player` and
`RewardReceipt`, then replay creates no second rent/mint; (8) missing player signature and wrong
payer; (9) insufficient balance with failed atomic init; (10) authority balance stays unchanged for
a player-funded action. These are written but remain pending local-validator execution.

`tests/aof_vrf_localnet.ts` now contains active (non-skipped) async physical cases: commit cost equals
the live `Mint + ATA + ToolData` rent cap; player pays price, deposit, commit rent and transaction fee;
reveal reimburses only actual rent while the cranker pays its network fee; timeout warp/refund returns
price, unused deposit and commit rent bond to the player and releases the VRF slot. These are test-code
changes only; the validator has not run in this environment.

## Порядок и статус

Коммиты: **4** — player-funded аккаунты (долги 1, 2, 4); **5** — player-claimed награды и сезон
(долги 3, 5); **6** — отказ backend от оплаты чужих ATA. После каждого: регенерация IDL скриптами,
`check-idl-drift.py`, `payer-audit --write/--check`, readiness, обновление `docs/PAYER_AUDIT.md` и
`docs/PAYER_MATRIX.*`. `payer-audit` освобождается от долга только вместе с кодом и тестом; baseline-
списка исключений у гейта нет.

Не проверено в песочнице: Rust/Anchor-компиляция, `anchor build`, validator, layout-тесты — на Mac/CI.
