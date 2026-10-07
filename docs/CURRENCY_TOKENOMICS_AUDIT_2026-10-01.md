<!-- HISTORICAL — superseded snapshot; preserved for audit history, not active product instructions. -->
# Аудит валют и токеномики: market, shop, staking, quests

Дата: 2026-10-01. Основа — код ветки `arena/01a0f563-aof`. Аудит писался как «ничего не менялось»: токеномика, валюты, mint'ы, казна и
комиссии остались как есть (по условиям задачи — без спецификации не трогать). Рынок на SOL не переключался, SPL-токены игры не удалялись,
исправление «только на frontend» не делалось.

**Обновление от 2026-10-01 (сессия `arena/01a0f648-aof`).** F-CURRENCY-01 исправлен в программе отдельным коммитом — см. раздел ниже;
валюты, комиссии и токеномика по-прежнему не менялись. Охранный тест:
`node --test tests/readiness/market-currency-binding.test.cjs`.

## Главное: F-CURRENCY-01 — валюта горячего рынка привязана к конфигу (ИСПРАВЛЕНО)

**Что было.** В `aof_market` `hot_market_buy` и `hot_market_sell_into_queue` брали валюту платежа из аккаунта `currency_mint`, но программа
**нигде не сверяла** его с `MarketConfig.core_mint` / `MarketConfig.gem_mint` по выбранному аргументу `currency`:

* `config.core_mint` и `config.gem_mint` **записывались** в `init_market_config` и больше **нигде не читались**;
* ограничения `HotMarketBuy` и `HotMarketSell` связывали токен-аккаунты только **друг с другом**
  (`buyer_currency.mint == currency_mint`, `pool_currency.mint == currency_mint`, `treasury_currency.mint == currency_mint`);
* тела обработчиков считали цену по `currency` (`pool_price(pool, currency, now)`) и переводили `token::transfer` в том mint'е, что передан.

**Как это эксплуатировалось (статическое рассуждение).** Злоумышленник создавал свой SPL-mint `F` и чеканил себе любой объём;
**бесправно** создавал ATA казны (`owner == config.treasury`) и ATA пула (`owner == pool PDA`) под `F` — создание ATA для чужого
владельца разрешено всем; вызывал `hot_market_buy(rarity, Core, max_price)` с `currency_mint = F`. Цена считалась из `target_price_core`,
платёж шёл в `F`, а настоящий инструмент NFT уходил из пула покупателю. Честный клиент (backend: `aof_backend/src/routes/hotMarket.ts:20–21`)
mint выбирает правильно, поэтому через API это не воспроизводилось — только прямым RPC-вызовом, то есть тем, от чего проект в остальных
местах защищается on-chain.

**Почему исправлено в программе, а не во frontend:** frontend/backend — не граница безопасности. Остальные программы привязывают mint к
конфигу (см. матрицу): `aof_quests` — `treasury_mascot.mint == quest_config.mascot_mint`, `aof_liquidity` — `address = lp_config.mascot_mint`.

**Сделано (коммит `fix: bind market currencies to configured canonical mints`).** В `programs/aof-market/src/lib.rs` аккаунт
`currency_mint` в `HotMarketBuy`, `HotMarketSell` и `PlaceLimitOrder` получил констрейнт, который связывает его с каноническим минтом
**выбранной** валюты:

```rust
#[account(
    mut,
    constraint = (
        (currency == Currency::Core && currency_mint.key() == config.core_mint)
        || (currency == Currency::Gem && currency_mint.key() == config.gem_mint)
    ) @ MarketError::InvalidCurrencyMint
)]
pub currency_mint: Account<'info, Mint>,
```

* `HotMarketSell` объявлял `#[instruction(rarity: u8)]` — без `currency` констрейнт не имел бы доступа к валюте; объявление приведено к
  полной подписи инструкции `(rarity: u8, currency: Currency, min_price: u64)`;
* констрейнт срабатывает при разборе аккаунтов, то есть **до первого `token::transfer`**; в телах `hot_market_buy` и
  `hot_market_sell_into_queue` та же проверка продублирована через `crate::tools::expected_currency_mint` — чтобы будущая правка структуры
  аккаунтов не оставила перевод без привязки;
* новый вариант ошибки — `MarketError::InvalidCurrencyMint` (не `CurrencyMismatch`: см. F-CURRENCY-04) → **IDL `aof_market` нужно пересобрать**;
* негативный validator-тест «чужой валютный mint отклоняется» добавлен в `tests/aof_market.ts` для обеих инструкций.

**Остаточный риск и что осталось проверить.** В песочнице агента нет `cargo`/`anchor`/`solana-test-validator`, поэтому Rust-код **не собран**,
а validator-тест **не запускался**: приёмка исправления требует `anchor build && anchor test --skip-build` на машине с тулчейном
(см. `docs/UNBLOCK_PLAN_2026-09-30.md`). До прогона считать F-CURRENCY-01 исправленным «по коду», но не подтверждённым валидатором.

Охранный тест держит документ и код согласованными: пока привязки в коде нет, этот раздел обязан быть помечен «ОТКРЫТО»; после исправления
тест требует пометить «ИСПРАВЛЕНО» и наличия validator-теста на чужой валютный mint.

## Матрица валют по подсистемам

Две валютные области: **SOL (lamports)** — почти всё в `aof_core`, и **SPL-токены игры** — рынок инструментов, награды, ликвидность, ресурсы.

| Подсистема | Инструкции | Валюта | Откуда валюта | Платит → получает | Комиссия | Привязка к конфигу в программе |
|---|---|---|---|---|---|---|
| **Market (hot market)** | `hot_market_buy`, `hot_market_sell_into_queue`, `init_pool`, `crank_market` | SPL: `core` (по умолчанию `Config.potatoMint`, «MIND») и `gem` (`MaterialMints.QUANTUM_BIT`) | `MarketConfig.core_mint/gem_mint`, выбираются при `init_market_config` (**необратимо**, setter'а нет); `devnet-bringup.sh` отказывается угадывать: нужны явные адреса | покупатель → резерв пула + казна; пул → продавец | `fee_bps` пула (по умолчанию 200) | **Да**: `currency_mint` сверяется с `core_mint`/`gem_mint` по `currency` (F-CURRENCY-01 исправлено) ✓. Казна — по владельцу ATA = `config.treasury` ✓ |
| **Market (limit orders)** | `place_limit_order` (отключена), `cancel_limit_order` | SPL (`Currency`) | — | — | — | `place_limit_order`: привязка к конфигу есть (та же, что у hot market); размещение по-прежнему отключено (`TradingDisabled`). `cancel_limit_order`: конфига в аккаунтах нет — возврат идёт из `order_vault` в `maker_currency` того же mint'а, подписант `maker`; рассинхронизации валют нет |
| **Marketplace** (листинги инструментов) | `marketplace_list`, `marketplace_buy_bounded`, `marketplace_cancel` | **SOL** | цена листинга в lamports | покупатель → продавец (97%) и казна (3%) | `MARKETPLACE_FEE_BPS = 300` | `treasury`: `address = config.treasury` ✓ |
| **Auction** | `auction_create/bid/settle/cancel` | **SOL** | ставки в lamports, мин. ставка 0.001 SOL | победитель → продавец и казна | `AUCTION_FEE_BPS = 400` | казна ✓ |
| **Offers** | `offer_create/accept/cancel` | **SOL** | эскроу в lamports | покупатель → продавец и казна | `OFFER_FEE_BPS = 250` | казна ✓ |
| **Rental** | `rental_list`, `rental_start_bounded`, `rental_end/revoke/delist` | **SOL** | цена за час в lamports | арендатор → владелец и казна | платформа ≥ `RENTAL_FEE_BPS = 500` | казна ✓ |
| **Order book ресурсов** | `place_*_order_v2`, `match_resource_orders_v2` (+ v1) | **SOL** за ресурс (SPL-токены ресурсов) | цена за целый ресурс в lamports | taker → maker, казна | maker 0.1% / taker 0.4% | казна ✓ |
| **Shop: паки** | `pack_open_commit/reveal/expire` | **SOL** | `PackConfig.price_lamports` (0.1 / 0.3 / 1.0 SOL по умолчанию) | игрок → эскроу → казна после reveal | — | казна ✓ |
| **Shop: прочее** | `reroll_random_*`, `forge_attempt_*`, `deposit_gas`/`withdraw_gas`, `craft` | **SOL** (газ-бак в «микро-SOL» 1e6/SOL) | константы `FEE_PER_*_MICROS`, `ENCHANT_FEE_LAMPORTS`, `FORGE_PROTECTOR_PRICE_LAMPORTS` | игрок → газ-бак/эскроу → казна | см. константы | казна ✓ |
| **Shop: сезонный пропуск** | `purchase_season_pass` (source path active; UI gate closed) | **SOL** | 0.15 SOL | игрок → казна | — | казна/цена привязаны; Devnet acceptance и matching-bytecode smoke ещё не подтверждены |
| **Lottery** | `buy_lottery_ticket`, `draw_lottery`, `claim_lottery_prize`, `refund_*` | **SOL** | билет 0.0008 SOL | игрок → пул (70%) / казна (30%) | `LOTTERY_POOL_BPS`/`LOTTERY_DEV_BPS` | казна ✓ |
| **Rebirth** | `do_rebirth` | **SOL** | `rebirth_cost_lamports` | игрок → казна | — | `address = rebirth_config.treasury` ✓ |
| **Staking инструментов** | `stake`, `unstake`, `collector_stake/unstake` | нет платежа | — | — | — | Коллекционеры — allowlist mint'ов (`register_collector_mint`) |
| **Liquidity (LP)** | `lp_deposit`, `lp_withdraw` | SPL: `mascot_mint` | `LpConfig.mascot_mint` | игрок ↔ пул | — | **Да**: `address = lp_config.mascot_mint` ✓ |
| **Quests** | `quest_claim_reward`, `drum_*`, `potato_spin_*` | SPL: `mascot_mint` (награды), POTATO (Potato V2) | `QuestConfig.mascot_mint/treasury_mascot` | казна → игрок | — | **Да**: `treasury_mascot.mint == quest_config.mascot_mint`, владелец = конфиг ✓ |
| **Ресурсы/выплаты** | `mint_resource*`, `pay_out*`, `collect_*` | SPL: 27 видов ресурсов | `Config`/`MaterialMints` | mint/vault → игрок | — | `is_resource_mint`, `IssuanceCap`, `VaultGuard` ✓ |

## Остальные наблюдения

* **F-CURRENCY-02 (дизайн, информационно).** `aof_liquidity` описан как «Liquidity Pools for Hot Market», но не связан с `aof_market` ни
  кодом, ни CPI (в `Cargo.toml` рынка нет зависимости от `aof_liquidity`). Вклады — в `mascot_mint`, а резерв рынка — в `core/gem`
  (POTATO/QUANTUM_BIT): «ликвидность рынка» сегодня — два не связанных механизма. Менять не нужно, но не стоит обещать игрокам связь.
* **F-CURRENCY-03 (единицы).** Цены пула — в **атомах** mint'а (`target_price_core/gem`), а `devnet-bringup.sh` по умолчанию ставит
  `MARKET_TARGET_CORE = MARKET_TARGET_GEM = 1000000000` атомов независимо от `decimals`. Для 9 знаков это 1 токен, для 6 — 1000.
  Тот же класс ошибок уже зафиксирован в коде: `drum_commit` закрыт, потому что «константы — сырые атомы, а не 5 целых единиц проверенного
  Potato-mint». Решение (и спецификацию цен) принимает владелец; скрипт и константы не менялись.
* **F-CURRENCY-04 (`CurrencyMismatch`).** Такого символа **нет нигде в репозитории** (grep по коду, IDL, документам и тестам — пусто). При
  исправлении F-CURRENCY-01 новым вариантом ошибки выбран `MarketError::InvalidCurrencyMint`, а не `CurrencyMismatch`: имя точнее описывает
  условие («пришёл не тот минт»), и утверждение этого пункта остаётся верным без правки тестов на отсутствие символа.
* Все пути **SOL** в `aof_core` привязывают казну к `config.treasury` (14 структур аккаунтов, проверено разбором `aof-core/src/lib.rs`).
* Выбор валют пула **необратим** (в `MarketConfig` нет setter'а): ошибка в адресах при `bringup` исправляется только новым Config
  (то есть новым деплоем/миграцией). Скрипт это учитывает (требует явных адресов, отказывается при нулевом/неопределённом).

## Что не менялось и почему

Токеномика, валюты, mint'ы, казна, комиссии, цены паков, потолки выпуска — **без изменений** (нет спецификации). Не переключалось
на SOL; SPL-токены игры не удалялись; frontend-«заплатка» не добавлялась; валюты рынка по-прежнему выбираются один раз в
`init_market_config` и остаются необратимыми (setter'а нет).

Изменён ровно один дефект — F-CURRENCY-01: добавлена проверка соответствия `currency_mint` каноническому минту выбранной валюты.
Rust-код собран не был (в песочнице нет `cargo`/`anchor`), validator-тест не запускался — это обязательный следующий шаг, описанный
в разделе F-CURRENCY-01.
