# Аудит валют и токеномики: market, shop, staking, quests

Дата: 2026-10-01. Основа — код ветки `arena/01a0f563-aof`. **Ничего не менялось**: токеномика, валюты, mint'ы, казна и комиссии
остались как есть (по условиям задачи — без спецификации не трогать). Рынок на SOL не переключался, SPL-токены игры не удалялись,
исправление «только на frontend» не делалось. Охранный тест: `node --test tests/readiness/market-currency-binding.test.cjs`.

## Главное: F-CURRENCY-01 — валюта горячего рынка не привязана к конфигу (ОТКРЫТО)

**Что.** В `aof_market` `hot_market_buy` и `hot_market_sell_into_queue` берут валюту платежа из аккаунта `currency_mint`, но программа **нигде не
сверяет** его с `MarketConfig.core_mint` / `MarketConfig.gem_mint` по выбранному аргументу `currency`:

* `config.core_mint` и `config.gem_mint` **записываются** в `init_market_config` (`programs/aof-market/src/lib.rs:277–278`) и больше
  **нигде не читаются** (grep по `programs/aof-market/src`: только объявление полей и эти две записи);
* ограничения `HotMarketBuy` (`lib.rs:94`) и `HotMarketSell` (`lib.rs:149`) связывают токен-аккаунты только **друг с другом**
  (`buyer_currency.mint == currency_mint`, `pool_currency.mint == currency_mint`, `treasury_currency.mint == currency_mint`);
* тела обработчиков считают цену по `currency` (`pool_price(pool, currency, now)`) и переводят `token::transfer` в том mint'е, что передан.

**Как это эксплуатируется (статическое рассуждение, PoC не запускался — нет валидатора).** Злоумышленник создаёт свой SPL-mint `F`
и чеканит себе любой объём; **бесправно** создаёт ATA казны (`owner == config.treasury`) и ATA пула (`owner == pool PDA`) под `F` —
создание ATA для чужого владельца разрешено всем; вызывает `hot_market_buy(rarity, Core, max_price)` с `currency_mint = F`.
Цена считается из `target_price_core`, платёж идёт в `F`, а настоящий инструмент NFT уходит из пула покупателю. Честный клиент
(backend: `aof_backend/src/routes/hotMarket.ts:20–21`) mint выбирает правильно, поэтому через API это не воспроизводится — только
прямым RPC-вызовом, то есть тем, от чего проект в остальных местах защищается on-chain.

**Почему именно так, а не «исправить во frontend»:** frontend/backend — не граница безопасности; защита обязана быть в программе.
Остальные программы привязывают mint к конфигу (см. матрицу): `aof_quests` — `treasury_mascot.mint == quest_config.mascot_mint`,
`aof_liquidity` — `address = lp_config.mascot_mint`; в `aof_market` этой привязки нет, и **теста на «чужой валютный mint» тоже нет**
(`tests/aof_market.ts:332` проверяет чужой *инструментальный* mint, а не валютный).

**Предлагаемое исправление (отдельным изменением; здесь НЕ применено: нужна сборка Rust, которой в песочнице нет, и решение владельца):**

```rust
// HotMarketBuy и HotMarketSell: #[instruction(rarity: u8, currency: Currency, …)] уже объявлен
#[account(
    constraint = currency_mint.key() == match currency {
        Currency::Core => config.core_mint,
        Currency::Gem  => config.gem_mint,
    } @ MarketError::CurrencyMismatch   // новый вариант ошибки → пересобрать IDL (check-idl-drift)
)]
pub currency_mint: Account<'info, Mint>,   // `mut` для mint здесь не нужен: transfer его не меняет
```

* добавить негативный validator-тест «чужой валютный mint отклоняется» для обеих инструкций (по образцу `tests/aof_market.ts:332`);
* **время важно:** по зонду 2026-09-30 `aof_market` ещё не развёрнут ни на одной сети — исправление до первого деплоя избавит от upgrade;
* пока не исправлено — **не включать рынок с реальной ценностью**; на devnet с тестовыми активами риск — потеря пула инструментов.

Охранный тест держит документ и код согласованными: пока привязки в коде нет, этот раздел обязан быть помечен «ОТКРЫТО»; после исправления
тест потребует пометить «ИСПРАВЛЕНО» и убрать рекомендацию.

## Матрица валют по подсистемам

Две валютные области: **SOL (lamports)** — почти всё в `aof_core`, и **SPL-токены игры** — рынок инструментов, награды, ликвидность, ресурсы.

| Подсистема | Инструкции | Валюта | Откуда валюта | Платит → получает | Комиссия | Привязка к конфигу в программе |
|---|---|---|---|---|---|---|
| **Market (hot market)** | `hot_market_buy`, `hot_market_sell_into_queue`, `init_pool`, `crank_market` | SPL: `core` (по умолчанию `Config.potatoMint`, «MIND») и `gem` (`MaterialMints.QUANTUM_BIT`) | `MarketConfig.core_mint/gem_mint`, выбираются при `init_market_config` (**необратимо**, setter'а нет); `devnet-bringup.sh` отказывается угадывать: нужны явные адреса | покупатель → резерв пула + казна; пул → продавец | `fee_bps` пула (по умолчанию 200) | **Нет** (F-CURRENCY-01). Казна — по владельцу ATA = `config.treasury` ✓ |
| **Market (limit orders)** | `place_limit_order` (отключена), `cancel_limit_order` | SPL (`Currency`) | — | — | — | Не применимо: размещение отключено (`TradingDisabled`) |
| **Marketplace** (листинги инструментов) | `marketplace_list`, `marketplace_buy_bounded`, `marketplace_cancel` | **SOL** | цена листинга в lamports | покупатель → продавец (97%) и казна (3%) | `MARKETPLACE_FEE_BPS = 300` | `treasury`: `address = config.treasury` ✓ |
| **Auction** | `auction_create/bid/settle/cancel` | **SOL** | ставки в lamports, мин. ставка 0.001 SOL | победитель → продавец и казна | `AUCTION_FEE_BPS = 400` | казна ✓ |
| **Offers** | `offer_create/accept/cancel` | **SOL** | эскроу в lamports | покупатель → продавец и казна | `OFFER_FEE_BPS = 250` | казна ✓ |
| **Rental** | `rental_list`, `rental_start_bounded`, `rental_end/revoke/delist` | **SOL** | цена за час в lamports | арендатор → владелец и казна | платформа ≥ `RENTAL_FEE_BPS = 500` | казна ✓ |
| **Order book ресурсов** | `place_*_order_v2`, `match_resource_orders_v2` (+ v1) | **SOL** за ресурс (SPL-токены ресурсов) | цена за целый ресурс в lamports | taker → maker, казна | maker 0.1% / taker 0.4% | казна ✓ |
| **Shop: паки** | `pack_open_commit/reveal/expire` | **SOL** | `PackConfig.price_lamports` (0.1 / 0.3 / 1.0 SOL по умолчанию) | игрок → эскроу → казна после reveal | — | казна ✓ |
| **Shop: прочее** | `reroll_random_*`, `forge_attempt_*`, `deposit_gas`/`withdraw_gas`, `craft` | **SOL** (газ-бак в «микро-SOL» 1e6/SOL) | константы `FEE_PER_*_MICROS`, `ENCHANT_FEE_LAMPORTS`, `FORGE_PROTECTOR_PRICE_LAMPORTS` | игрок → газ-бак/эскроу → казна | см. константы | казна ✓ |
| **Shop: сезонный пропуск** | `purchase_season_pass` (отключена) | **SOL** | 0.15 SOL | игрок → казна | — | казна ✓; инструкция закрыта до приёмочного гейта |
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
* **F-CURRENCY-04 (`CurrencyMismatch`).** Такого символа **нет нигде в репозитории** (grep по коду, IDL, документам и тестам — пусто). Если
  в вашей версии он есть, это другая ветка; в этой ближайший реальный дефект — F-CURRENCY-01, а `CurrencyMismatch` естественно было бы
  именем новой ошибки для его исправления.
* Все пути **SOL** в `aof_core` привязывают казну к `config.treasury` (14 структур аккаунтов, проверено разбором `aof-core/src/lib.rs`).
* Выбор валют пула **необратим** (в `MarketConfig` нет setter'а): ошибка в адресах при `bringup` исправляется только новым Config
  (то есть новым деплоем/миграцией). Скрипт это учитывает (требует явных адресов, отказывается при нулевом/неопределённом).

## Что не менялось и почему

Токеномика, валюты, mint'ы, казна, комиссии, цены паков, потолки выпуска — **без изменений** (нет спецификации). Не переключалось
на SOL; SPL-токены игры не удалялись; frontend-«заплатка» не добавлялась; Rust-код не правился (нет `cargo`, исправление F-CURRENCY-01
нужно собрать и протестировать на валидаторе). Отдельным изменением предлагается только то, что описано выше.
