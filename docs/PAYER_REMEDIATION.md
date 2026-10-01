# Payer remediation — план коммитов 4–6 (пункт 10)

Правило владельца: **любой live player-specific аккаунт оплачивает игрок**. Проект платит только за
deployment, глобальный `Config`, глобальные реестры, treasury/vault/pool-инфраструктуру,
emergency/security-аккаунты и admin-синглтоны. Gasless-онбординг не добавляем; service/cranker может
авансировать rent только при доказанном возмещении из user-prepaid escrow, с capped fee и возвратом
остатка.

Матрица и гейт: `docs/PAYER_MATRIX.md`, `security/payer-policy.json`, `scripts/payer-audit.mjs`.
Текущее состояние (после шага B): **90 init-аккаунтов, 86 ok, 5 долгов**.

Этот документ — обязательная спецификация следующих трёх коммитов: каждая правка перечисляет, что
именно меняется в коде, что это делает с IDL и что обязано быть проверено. Все изменения контекстов
Anchors — **pending validation**: без `anchor build` и validator-прогона они не считаются принятыми.

## Долг 1–2: профиль игрока в операторских выдачах

**Где:** `aof-core/src/lib.rs:552` (`MintResource.player`) и `aof-core/src/lib.rs:596`
(`MintResourceOnce.player`) — `init_if_needed, payer = authority`, seeds
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

**Где:** `aof-core/src/lib.rs` (`MintTool.tool_data`, `init_if_needed, payer = authority`);
получатель — `recipient: UncheckedAccount` без подписи.

**Почему долг:** `ToolData` — собственность получателя, но получатель не подписант, а rent платит
authority.

**Правка (коммит 4):**

* новый аккаунт `payer: Signer<'info>`; `tool_data` — `init_if_needed, payer = payer`;
* констрейнт `payer.key() == recipient.key() @ AofError::Unauthorized` — player-mint: платит и
  подписывает получатель, третья сторона (включая проект) физически не может оплатить чужой
  `ToolData`;
* если нужна подпись authority (операторский минт), это частично подписанная tx по тому же правилу,
  что в долге 3: quote + expiry, игрок проверяет message и подписывает как payer, authority
  подписывает только authorization-инструкцию и не передаёт свой ключ.

**IDL/клиенты:** +1 signer; backend (`tools.ts`, admin-роуты минта) передаёт кошелёк игрока как
payer вместо `AUTHORITY_PUBKEY`.

**Тест:** минт без подписи получателя отклоняется; с подписью — rent `ToolData` списан с
получателя, lamports authority не изменились.

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
