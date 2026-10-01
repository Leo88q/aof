# Stale ownership после обычного SPL-перевода: ревью market / rental / auction / listing

Дата: 2026-10-01. Пункт 8 порядка работ (см. Draft PR #32).
Метод: **статический разбор аккаунт-контекстов и обработчиков** (Rust не компилировался,
validator не запускался — см. границу доказанности в конце).

## Постановка

Инструмент — обычный classic SPL-токен (decimals 0, supply 1). Держатель может
перевести его `spl_token::transfer` мимо программы; программа этого не видит.
`ToolData.owner`/`operator` — кэш, и он в этот момент отстаёт от факта. Вопрос
пункта 8: где отставший кэш мог бы авторизовать ценность в
market / hot market / auction / offer / rental / listing, и нужен ли там
дополнительный жёсткий lock.

## Главный инвариант: кэш пишут только token-anchored пути

Полный список записей `ToolData.owner`/`operator` (grep по всем инструкциям):

| Инструкция | Что пишет | Чем якорь |
|---|---|---|
| `mint_tool` | `owner = recipient`, `operator = recipient` | минт создаётся тут же, 1 единица идёт на ATA получателя (`token_account.owner == recipient`) |
| `transfer_tool` | `owner/operator = recipient` | NFT переводится из ATA отправителя в ATA получателя в той же инструкции |
| `sync_tool_owner` | `owner/operator = holder` | подписант держит `amount == 1` на своём ATA, mint канонический |
| `marketplace_buy` | `owner/operator = buyer` | NFT переводится `listing_vault → buyer_token`, `buyer_token.owner == buyer` |
| `auction_settle` | `owner/operator = current_bidder` | NFT переводится `auction_vault → winner_token`; ставится **только** в ветке `amount > 0`, т.е. когда победитель есть |
| `offer_accept` | `owner/operator = offer.buyer` | NFT переводится `seller_token → buyer_token`, `buyer_token.owner == offer.buyer` |
| `rental_start` | `operator = renter` | право делегируется в рамках активной записи; NFT остаётся в эскроу |
| `rental_end` / `rental_revoke` | `operator = tool.owner` (кэш) | возврат делегирования после/при отзыве аренды |
| ~~`migrate_tool`~~ | — | **удалена** (шаг B пункта 12): pre-genesis-миграция без развёртывания, минт шёл в vault без шага выдачи игроку |
| `settlement::write_tool` (pack/reroll/forge/exploration) | `owner/operator = user` | вызывается только для свежесозданного mint'а в той же инструкции |

Следствие: **пока токен лежит в escrow программы (stake vault / listing vault /
auction vault / rental vault), кэш не может разойтись с эскроу.** Единственные
пути, меняющие `owner`, требуют либо личного ATA подписанта, либо escrow-подписи
PDA программы, либо свежесозданного mint'а. Значит, «сначала выставил на
продажу, потом увёл токен» и «продал эскроу-инструмент дважды» неконструируемы.

Ниже — по каждой механике: угроза, нужен ли жёсткий lock, можно ли безопасно
инвалидировать действие после перевода, нужен ли custody.

## 1. Marketplace listing (`marketplace_list` / `_buy` / `_buy_bounded` / `_cancel`)

* **Custody**: жёсткий — при `list` NFT уходит в `listing_vault` (`owner = listing`,
  PDA `[LISTING_SEED, mint]`). Пока листинг жив, обычный перевод невозможен.
* **Угроза «листинг → перевод мимо эскроу»**: не существует (токен не у владельца).
* **Угроза «stale листинг»**: PDA выводится из mint, поля `listing.mint` и
  `tool.mint` сверяются; `marketplace_buy` дополнительно требует
  `tool.operator == tool.owner` и `!staked && !is_mining`.
* **Кто получает деньги**: `seller` привязан к `listing.seller` (`address =`),
  а не к текущему кэшу. Рассинхронизации «деньги ушли не тому» нет.
* **Инвалидация**: не нужна — эскроу и есть lock. Exit-путь
  `marketplace_cancel` подписывает `listing.seller` (не permissionless, но
  доступен всегда и не блокируется паузой: `config` в контексте без `!paused`).
* **Вывод**: жёсткий lock оправдан и уже есть; добавлять ничего не нужно.

## 2. Auction (`auction_create` / `_bid` / `_settle` / `_cancel`)

* **Custody**: та же схема — `auction_vault` (`owner = auction`, PDA
  `[AUCTION_SEED, mint]`); ставки — только lamports, NFT не двигается до settle.
* **Settle permissionless**: победитель берётся из записи аукциона
  (`current_bidder`, иначе `seller`), а `winner_token` обязан быть **каноническим
  ATA** этого адреса (`is_canonical_ata`). Кэш обновляется ровно в ветке, где NFT
  реально ушёл победителю.
* **Кто получает деньги**: `auction.seller` (`address =`), не кэш.
* **Особенность**: `settle` требует `tool.operator == tool.owner` — инструмент в
  аренде/делегировании не продаётся до возврата делегирования. Это осознанно
  (см. комментарий в `rental.rs`), инвариант не нарушается.
* **Вывод**: жёсткий lock уже есть; дополнительных мер не требуется.

## 3. Offer (`offer_create` / `_accept` / `_cancel`)

* **Custody**: NFT **не** эскроится заранее (осознанный выбор: владелец свободен
  передумать). Эскроится только платёж покупателя — в самом `Offer` PDA.
* **Угроза**: владелец перевёл инструмент обычным переводом и затем вызывает
  `offer_accept`. Кэш ещё говорит `tool.owner == seller`, `seller_token.owner ==
  seller` проходит, но на ATA уже 0 единиц → SPL-трансфер `1` падает, вся
  инструкция откатывается. **Fail-safe**: ни покупатель, ни продавец не теряют
  ничего, оффер остаётся открытым, lamports покупателя остаются в его же
  `Offer` PDA, и `offer_cancel` (подпись покупателя) доступен всегда.
* **Остаток**: проверки `seller_token.amount == 1` нет, поэтому отказ приходит
  сырой SPL-ошибкой вместо `AofError::ZeroAmount`. Это косметика/UX, не дыра;
  уже зафиксировано в `docs/TOOL_OWNERSHIP_MODEL.md`.
* **Вывод**: жёсткий lock не нужен — сценарий деградирует в отказ без потери
  ценности. Достаточно добавить `amount == 1` для чистого кода ошибки.

## 4. Rental (`rental_list` / `_start` / `_end` / `_revoke` / `_delist`)

* **Custody**: при `rental_list` NFT уходит в `rental_vault` (`owner =
  rental_listing`) и лежит там **всё время** листинга и аренды. Токен арендатору
  не передаётся — меняется только `ToolData.operator`. Именно поэтому формула
  «`token_account.owner == operator`» для аренды неверна: арендатор — operator,
  но токеном не владеет.
* **Угроза «арендодатель увёл токен во время аренды»**: невозможна (эскроу).
* **Угроза «stale аренда после перевода»**: невозможна: `rental_start` требует
  `tool.owner == rental_listing.owner` + NFT `amount == 1` в `rental_vault`, а
  пока NFT в эскроу — кэш не разъедется (см. инвариант выше). `rental_end` и
  `rental_revoke` возвращают `operator` текущему `tool.owner`, а не снимку в
  соглашении.
* **РЕШЕНО (отдельным изменением, Этап 8): делегированные действия арендатора
  были недостижимы.**
  * `start_mining`/`collect_mining` требуют `tool.staked == true`, а
    `rental_list` требует `!tool.staked` — арендованный инструмент не может
    майнить ни у арендатора, ни у владельца. Констрейнт `staked` на
    `StartMining` существовал до этого изменения (проверено: `git show
    6ea5377^:aof-core/src/lib.rs` содержит `constraint = tool.staked`);
    escrow-proof лишь сделал противоречие явным.
  * `repair` в обработчике требует `tool.owner == user`, поэтому арендатор не
    может чинить (только владелец).
  * Все остальные operator-гейты (`craft`, `reroll`, `stake`, `unstake`,
    `burn_tool`, `burn_nft`, `start_exploration_commit`) тоже требуют
    `owner == user`.
  * Итог: `operator` не давал арендатору ни одного доступного действия. Это
    механика-баг уровня продукта, а не дыра безопасности (лишних прав никто не
    получал).
  * **Как закрыто:** добавлены три делегированные инструкции
    (`start_mining_delegated`, `collect_mining_delegated`, `repair_delegated`) с
    общим proof'ом `tool_ownership::assert_rental_delegation` (активная
    `RentalAgreement`: `renter == operator == подписант`, владелец совпадает,
    листинг активен, инструмент не в стейке; для старта — `now < end`) и
    эскроу-проверкой токена в `rental_vault`. Сессия обязана уместиться в срок
    аренды (`RentalSessionTooLong`), а `rental_end`/`rental_revoke` гасят
    брошенную сессию. Подробности и семантика награды —
    `docs/TOOL_OWNERSHIP_MODEL.md`.
* **Вывод**: жёсткий lock уже есть (эскроу листинга). Дополнительный custody не
  нужен; нужен разбор достижимости delegated-действий.

## 5. Hot market и лимитные ордера (`aof_market`)

* `aof_market` **не пишет** `ToolData` сам (grep: ни одной записи `.owner =`), а
  вызывает типизированный CPI `aof_core::transfer_tool` — обе мутации
  (NFT + кэш) происходят в одной атомарной инструкции. Окна
  «заплатили, но владение не перешло» нет.
* Перед CPI `tools::read_canonical_tool` сверяет: PDA `[TOOL_SEED, mint]` от
  `aof_core::ID`, дескриминатор `ToolData`, `mint`, `owner == expected`,
  `operator == expected`, `!staked && !is_mining`, редкость.
* `hot_market_sell_into_queue` дополнительно требует `seller_tool.owner == seller`
  и `amount >= 1`; `transfer_tool` — `sender_token.owner == sender`,
  `amount >= 1`, `tool_data.owner/operator == sender`, `!staked && !is_mining`,
  а также `recipient_token.amount == 0` (запрет второго инструмента на один ATA).
* Пул — обычный держатель: продавец переводит NFT в пул, покупатель получает NFT
  из пула тем же CPI.
* **Вывод**: stale-ownership окна нет; жёсткий lock не нужен, потому что
  используется атомарный канонический перевод. Валютная привязка (F-CURRENCY-01)
  закрыта отдельно: `currency_mint` обязан совпасть с `config.core_mint`/
  `gem_mint` для выбранной `Currency`.

## Что в итоге нужно и не нужно

| Механика | Жёсткий lock | Инвалидация после raw transfer | Custody | Действие |
|---|---|---|---|---|
| Marketplace listing | есть (listing_vault) | не требуется | есть | — |
| Auction | есть (auction_vault) | не требуется | есть | — |
| Offer | нет и не нужен | отказ всей инструкции | только платёж | добавить `amount == 1` (косметика) |
| Rental | есть (rental_vault) | не требуется | есть | закрыто: delegated-инструкции + proof аренды |
| Hot market / лимитные ордера | не нужен | атомарный `transfer_tool` CPI | нет | — |

## Граница доказанности

Разбор **статический**: в песочнице агента нет `cargo`/`anchor`/
`solana-test-validator`, поэтому Rust не компилировался, а сценарии из
`tests/aof_tool_ownership.ts` (в т.ч. «listing escrow не уводится переводом»)
не запускались. Утверждения выше — вывод из аккаунт-контекстов и обработчиков,
а не результат исполнения. Для аренды вывод опирается на чтение констрейнтов
`StartMining`/`CollectMining`/`Repair`/`RentalListCtx` в текущем дереве и на
`git show 6ea5377^` для подтверждения, что `staked`-гейт не появился в этом PR.
