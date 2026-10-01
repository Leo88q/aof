# Аудит плательщиков (пункт 10 плана)

> **Текущий acceptance-статус: ОТКРЫТ.** По статусу владельца остаются **5 live payer debts**;
> payer remediation не принята и не закрыта. Статический инвентарь ниже сейчас печатает `debt=0`,
> но это расхождение нельзя трактовать как закрытие: `payer-audit` классифицирует только init-account
> payer из текущих исходников и policy, а не доказывает end-to-end поведение или Anchor/validator
> исполнение. До отдельной сверки пяти пунктов и валидаторных lamport-delta проверок долг остаётся
> блокером; этот документ не закрывает Step C.

## Правило владельца

**Игрок платит сетевую комиссию и rent своих аккаунтов/действий.** Проект платит только за
 deployment, Config, глобальные реестры, treasury/vault/pool-инфраструктуру, emergency/security и
 admin-синглтоны. Authority авторизует, но не платит rent за игрока и не получает игровые средства;
gasless-онбординг и массовые hard locks не добавляются. Cranker может авансировать rent только из
user-prepaid escrow с capped fee, timeout/refund и возвратом остатка игроку.

## Инвентарь и гейт — статический результат, не acceptance

* Инструмент: `node scripts/payer-audit.mjs --check` (перегенерация — `--write`).
* Политика: `security/payer-policy.json`; generated matrix: `docs/PAYER_MATRIX.md` и
  `docs/PAYER_MATRIX.json`.
* Гейт: `tests/readiness/payer-audit.test.cjs`; backend ATA gate —
  `tests/readiness/ata-funding.test.cjs`.
* Текущий static охват: **89 init/`init_if_needed` accounts** в шести программах; 49 записей с
  `requiredPayer=player`, 24 — `operator`, 15 — `cranker-deposit`, 1 — `service`; статических строк
  `status=debt` — **0**.
* Эти числа подтверждают только согласованность текущей policy с распознанными init-контекстами.
  Они не заменяют payer acceptance-тесты, проверку фактического signer/fee payer, generated IDL,
  validator и lamport deltas.

## Пять owner-tracked live debts — acceptance остаётся открытым

Это исходные пять долгов из remediation inventory. Исходники содержат proposed/source-level правки,
но владелец не принял их как закрытые; каждый пункт остаётся открытым до Anchor build и поведения на
validator.

| Пункт | Проверяемое свойство | Текущее acceptance |
|---|---|---|
| `MintResource.player` | Операторская выдача не создаёт и не оплачивает профиль; отсутствие профиля не ломает выдачу | Open — source change есть, validator/lamport proof pending |
| `MintTool.tool_data` | Authority не payer; player-funded mint оплачивается и подписывается игроком; `ToolData.owner` остаётся кэшем, ownership подтверждает SPL supply-1/ATA | Open — source/readiness checks не являются validator proof |
| `MintResourceOnce.player` | Получатель подписывает claim и оплачивает профиль; `payer` связан с владельцем ATA | Open — payer acceptance pending |
| `MintResourceOnce.reward_receipt` | Игрок оплачивает свой одноразовый `RewardReceipt`; claim без подписи игрока отклоняется | Open — payer acceptance pending |
| `GrantSeasonXp.season_pass` | XP grant не создаёт пропуск за счёт authority; `init_season_pass` — player signer/payer | Open — payer acceptance pending |

`tests/aof_payer_funding.ts` содержит 10 intended validator checks; пункты 8 и 9 помечены `skip`
(требуют VRF/warp-сценария). Ни Anchor build, ни validator payer suite в этой среде не запускались.

## Backend quotes, сезонный пропуск и ATA

* Backend `coSign()` возвращает частично подписанную транзакцию с недавним blockhash; срок действия
  ограничен blockhash. Wallet обязан отправить именно этот payload, не создавать authority-funded
  замену и не повторять неопределённый результат без сверки подписи.
* Сезонный пропуск создаётся отдельным `init_season_pass` с подписью и payer игрока. UI показывает
  текст «Цена пропуска: 0 игровых токенов / Сетевые расходы и rent оплачивает игрок» и получает
  live quote только когда on-chain snapshot не содержит `SeasonPass`; rent существующего пропуска
  повторно не добавляется. Поведение требует runtime/validator-подтверждения.
* `ata-funding` readiness gate разбирает вызовы создания ATA в backend routes: `AUTHORITY_PUBKEY`
  допустим только для закрытого списка инфраструктурных owners (treasury/pool/listing/auction и т.п.).
  По текущей статической проверке user ATA создаются в транзакции игрока; gate не доказывает
  фактические lamport deltas в validator.
* Async-награда идёт как entitlement/voucher → player claim; RewardReceipt не создаётся на частом tick.
  Предоплаченный cranker path должен сохранять cap, expiry/timeout refund и возврат escrow/rent bond.

## Prepaid и инфраструктурные исключения

Асинхронный cranker не должен спонсировать игрока: `tool_settlement_rent()` оценивает Mint + ATA +
ToolData, commit кладёт cap в `deposit_lamports`, а settlement возвращает поселенцу
`min(deposit, fronted_rent)` в той же транзакции; остаток escrow принадлежит игроку. Отдельно
проверять timeout/expiry и capped cranker fee на validator.

Допустимые project-funded аккаунты ограничены инфраструктурой. Oracle/service payer не приравнивается
к hot authority. В `ExploreReveal` и активных reveal-путях пользовательские ATA должны быть уже
оплачены игроком при commit; проверки наличия/constraint и disabled-инструкции не являются основанием
расширять payer allowlist.

## Обязательные закрывающие gates

1. Сверить пять owner-tracked пунктов с кодом и policy; не использовать `debt=0` как acceptance.
2. Backend/frontend typecheck, frontend build и generated-client compile — честный pending, если в
   среде нет TypeScript toolchain.
3. `anchor build`, `anchor test --skip-build`, включая payer, ownership, F-CURRENCY и lamport-delta
   tests; проверить generated IDL без непредусмотренного `idls/` diff.
4. Перепроверить live quote, отсутствие повторного rent существующего SeasonPass/ATA, authority
   signature/expiry и отказ claim без подписи игрока.

Deployment запрещён до завершения этих gates и отдельного owner acceptance.
