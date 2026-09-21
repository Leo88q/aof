# AOF (Age of Farming) — полный независимый аудит

**Дата:** 2026-09-21
**Ветка:** `arena/01a0c415-aof` (база `24be7b1`)
**Объём:** 6 on-chain программ (`aof-core` 2880 LOC + 5 программ 2426 LOC), Express-бэкенд, Vite-фронтенд, IDL, конфиги деплоя, документация
**Метод:** статический анализ исходников + точечные прогоны собственных скриптов-валидаторов. Байткод не верифицировался, ончейн-состояние не снималось (см. §8).

---

## 1. Executive summary

Проект выглядит как перенос существующей браузерной игры (Ronin) на Solana, выполненный преимущественно с помощью ИИ-ассистента. Код на удивление аккуратен в «классических» местах: `Config` — настоящий singleton-PDA, `initialize()` привязан к upgrade authority через канонический `ProgramData`, почти везде есть `checked_*` арифметика, `overflow-checks = true`, много честных `require!(false, FeatureDisabled)` на незавершённых механиках. Это **не** халтура.

Проблема в другом. **Ключ, который подписывает всё, один, не ротируется и лежит в переменной окружения бэкенда.** Ни в одной из шести программ нет инструкции смены authority — значит `Config.authority` заморожен навсегда в момент первого `initialize()`. Поверх этого `pay_out` позволяет этому ключу вывести **любое** количество **любых** токенов из vault-PDA на **любой** кошелёк, без привязки к стейкингу и без обновления `ToolData` — то есть кража ключа равна полной потере всех застейканных NFT игроков.

Второй слой — экономика. Она не просто «не откалибрована», она **арифметически перевёрнута**: доходность майнинга растёт с 10 до 18 ед./час (×1.8), а стоимость ремонта — с 3 до 70 WOOD за единицу прочности (×23.3). Итог: портфель из 6 инструментов, работающий на износ, **убыточен по обоим ресурсам уже с Rare-редкости**, а с Uncommon — по WOOD. Прокачка инструмента делает игрока беднее за единицу активности.

Третий слой — «защита», которая не защищает. `IssuanceCap` преподносится в `docs/ISSUANCE_CAPS_DESIGN.md` как ответ на безлимитную эмиссию authority. На деле кап проверяется только в `mint_resource`/`mint_resource_once`; семь других инструкций минтят ресурсы напрямую через auth-PDA и капа не видят вообще. CI-гейт `scripts/check-mint-writable.py` рапортует «OK, 53 поля» и при этом молча пропускает `craft_recipe`, у которого все три mint-аккаунта не помечены `mut` — все 8 рецептов гарантированно отваливаются на валидаторе, хотя фича проведена端到端 через UI и бэкенд.

Четвёртое: значительная часть игры отключена. Из 87 инструкций `aof-core` шесть начинаются с `require!(false)`. Полностью неработоспособны: паки, кузница, честный reroll, экспидиции, лотерея, барабан, коллекционные перки, rebirth, сессионные ключи, весь `aof-market`. Единственный работающий источник случайности — `SlotHashes` + секрет, который держит authority; модуль сам про себя пишет «NOT a VRF… must remain disabled», но живые инструкции раскрытия (`pack_open_reveal`, `reroll_random_reveal`, `explore_reveal`, `forge_attempt_reveal`, `draw_lottery`) остаются вызываемыми.

Пятое, и это надо отдать должное: **сайт и UI честно помечают отключённые механики статусом «soon» с указанием конкретной причины и имени инструкции** (`frontend/src/site/content/mechanics.ts`, `FeatureDisabledNotice.tsx`). Это редкая и правильная практика — маркетинг не врёт о том, чего нет.

**Короткий вердикт:** код безопаснее, чем экономика; экономика не готова к mainnet; централизация authority — критический единый отказ. Проект **не готов** к продакшену с реальными деньгами.

---

## 2. Таблица находок

Сокращения компонентов: **CORE** = `aof-core`, **MKT** = `aof-market`, **QST** = `aof-quests`, **RBT** = `aof-rebirth`, **LIQ** = `aof-liquidity`, **SK** = `aof-session-keys`, **BE** = `aof_backend`, **FE** = `frontend`.

| # | Sev | Компонент | Описание | Сценарий эксплуатации (PoC) | Рекомендация |
|---|-----|-----------|----------|------------------------------|--------------|
| **F-01** | 🔴 **Critical** | CORE `PayOut`/`PayOutWithReferral` (`lib.rs:843`, `lib.rs:1130`; `pay_out.rs:9`) | Authority-only инструкция, изымающая `amount` любого mint из `vault_token` в любой `user_token`. Единственная проверка получателя — `user_token.mint == mint.key()`. Нет привязки к стейкингу, нет лимита на сумму, **нет обновления `ToolData`**. (`PayOutWithReferral` дополнительно проверяет `!config.paused`, но это не ограничивает вывод.) | 1. Атакующий получает `AUTHORITY_SECRET_KEY` (env бэкенда) или становится инсайдером. 2. Вызывает `pay_out(mint=<mint застейканного Legendary-топора>, amount=1, user_token=<свой ATA>)`. 3. SPL-трансфер подписывается `vault` PDA. 4. NFT у атакующего, а `ToolData.staked` осталась `true` → настоящий владелец не может ни `unstake` (трансфер из опустевшего vault упадёт), ни доказать кражу через `ToolData`. Повторить для всех NFT в vault | Удалить инструкцию из программы либо: (а) привязать к конкретному `ToolData` PDA и требовать `tool.staked && tool.owner == user_token.owner && now >= tool.unlock_at`; (б) списывать `amount` из vault только в размере, равном одной единице, и атомарно сбрасывать `tool.staked = false`; (в) вынести на multisig с timelock |
| **F-02** | 🔴 **Critical** | Все 6 программ | **Нет ни одной инструкции смены authority** (`grep set_authority → пусто`). `Config.authority` фиксируется в `initialize()` и навсегда равна upgrade-authority на момент первого деплоя. Бэкенд держит этот секретный ключ в процессе (`config.ts:23 Keypair.fromSecretKey(bs58.decode(process.env.AUTHORITY_SECRET_KEY))`). Бласт-радиус: mint ресурсов/инструментов, `adjust_player_capacity` (обнулить жителей любому игроку), `sweep_gas_fees`, `pay_out`, `set_paused`, `set_resource_mints`, `set_craft_economy`, `grant_season_xp` | Компрометация одного env-файла = полный контроль над экономикой. Ротация невозможна без редеплоя программы и переноса всех аккаунтов. План из `docs/ISSUANCE_CAPS_DESIGN.md §5` («перевести `config.authority` на Squads vault») **невыполним**: после перевода upgrade authority на Squads `Config.authority` останется старым хот-кеем — инструкции требуют именно `Config.authority` | Добавить `set_authority(new_authority)` с двухшаговым accept; выделить отдельный `MintDelegate` PDA для рутинных выплат (это уже описано в docs, но не реализовано); перевести `Config.authority` на Squads **до** первого деплоя; хот-кей бэкенда держать в KMS/HSM, не в env |
| **F-03** | 🟠 **High** | CORE `issuance_cap` / `collect_mining` и др. | `IssuanceCap::charge()` вызывается **только** из `mint_resource`/`mint_resource_once`. Минт без капа: `collect_mining` (`collect_mining.rs:77`), `collect_flour:26`, `collect_bread`, `collect_well_water:56`, `explore_reveal:103`, `craft_recipe`, `claim_season_reward:84`. Документация (`docs/ISSUANCE_CAPS_DESIGN.md`, шапка) продаёт кап как «ограниченная эмиссия за эпоху» при утечке authority | Утёкший хот-кей минтит WOOD не через `mint_resource`, а раздаёт каждому сибилу по Reaper/кирке (`mint_tool` тоже authority) и крутит `collect_mining` — кап не срабатывает ни разу. Или проще: `collect_well_water` на 10 000 кошельках даёт 788 млн WATER за год, кап = 0 проверок | Перенести `charge()` во все семь минтящих путей; добавить глобальный `TotalSupplyCap` на mint; покрыть тестами |
| **F-04** | 🟠 **High** | CORE `CraftRecipe` (`lib.rs:2205`) | `input_1_mint`, `input_2_mint`, `output_mint` объявлены **без `mut`**. SPL Token меняет `mint.supply` при `mint_to`/`burn`, поэтому рантайм отклонит запись в read-only аккаунт. **Все 8 рецептов не выполняются ни разу** | 1. Вызвать `craft_recipe(recipe_id=0)` с корректными аккаунтами. 2. `token::burn` внутри макроса падает с `writable privilege escalated`. Потрачены gas + время; GEM*/FLASK* экономика не существует | Добавить `mut` всем трём mint-аккаунтам. Расширить regex в `check-mint-writable.py` на `$mint`-интерполяцию внутри `macro_rules!` |
| **F-05** | 🟠 **High** | CI `scripts/check-mint-writable.py` | Гейт рапортует `OK (53 mint CPI field(s) checked)`, но `CPI_BOUND_RE` = `mint:\s*(\w+)\.to_account_info` не матчит `$mint.to_account_info()` — в `craft_recipe` CPI спрятаны в `macro_rules!`. Проверено: на `craft_recipe.rs` оба regex дают `[]` | Ложное чувство защищённости: именно тот класс бага, который гейт должен ловить, им не покрывается. Все остальные инструкции (plant_seeds, start_milling, start_baking, harvest_wheat и др.) уже были починены этим же гейтом — но не эта | Добавить в гейт разбор `macro_rules!`; добавить негативный тест «гейт обязан падать на read-only mint» |
| **F-06** | 🟠 **High** | CORE `randomness.rs` + 5 reveal-инструкций | `randomness.rs:7-11` сам говорит: «LEGACY randomness, NOT a VRF… secret holders can withhold unfavorable reveals… New economic commitments using this module must remain disabled». При этом живы `pack_open_reveal` (authority-only), `reroll_random_reveal`, `explore_reveal`, `forge_attempt_reveal`, **`draw_lottery`** | **Лотерея полностью на цепи:** `commit_lottery_draw(commit_hash)` → `draw_lottery(secret)`. Authority сам генерирует секрет. После того как commit-транзакция приземлилась, хэш слота公开 — можно офчейн перебрать секреты и подобрать тот, что даёт нужный `winning_ticket`. Обязательного settlement нет, таймаута нет, пути возврата пула нет (`ClaimLotteryPrize` требует `round.drawn`) → при «неудачном» исходе раунд просто не раскрывается, деньги заперты навсегда | Перейти на ORAO/Switchboard VRF; до этого — удалить `draw_lottery`/`commit_lottery_draw` из бинарника или закрыть их `FeatureDisabled`; добавить принудительный settlement + refund по таймауту для раунда |
| **F-07** | 🟠 **High** | BE `src/middleware/apiKey.ts:43` | API-ключи генерируются через `Math.random()` — **не** CSPRNG: `` `aof_${tier}_${Date.now()}_${Math.random().toString(36).slice(2,10)}` ``. Ключи хранятся в БД в открытом виде, без хэширования и без скоупа | V8 `Math.random` — xorshift128+; по нескольким выданным ключам восстанавливается состояние генератора, дальше предсказываются все последующие ключи. Ключ даёт доступ к mutation-эндпоинтам, защищённым wallet-proof | `randomBytes(32).toString('base64url')`; хранить только `sha256(key)`; привязывать ключ к origin/субъекту |
| **F-08** | 🟠 **High** | CORE экономика (`constants.rs` REPAIR_* vs `collect_mining.rs` YIELD) | Кривая ремонта растёт ×23.3, кривая добычи ×1.8. Портфель 6 инструментов (3 axe + 3 pick), 20 ч/сут: Common **+240 WOOD / +360 STONE**, Uncommon **−30 / +210**, Rare **−900 / −300**, Epic **−2700 / −1500**, Legendary **−7320 / −4320** (см. §3, табл. 2) | Рациональный игрок: качает инструмент → майнинг становится убыточным → перестаёт играть или не майнит. Прокачка = наказание. Экономика поощряет сидеть на Common и не развиваться | Пересчитать `REPAIR_*` (целевое соотношение: repair_wood < yield/2 для всех редкостей) либо ввести ремонт за SOFT-ресурс, а не за дефицитные WOOD/STONE. Обязательно — юнит-тест «net P&L > 0 для всех редкостей» |
| **F-09** | 🟠 **High** | CORE `reroll` (`lib.rs:580`, `reroll.rs`) | `reroll`: 2 инструмента редкости R → 1 инструмент R+1. Цена фикс — `FEE_PER_REROLL_MICROS` = **0.06 SOL из GasTank**. **Ресурсов нет, authority не нужен, `rarity_counter` не трогается** — то есть связующая кривая крафта его не касается | Common → Legendary: 16 Common, 15 вызовов, 0.90 SOL, **0 ресурсов**. Через `craft` тот же путь стоит 2750 WOOD + 2120 STONE + 1430 FOOD + 710 SEEDS + 540 WATER + 630 POTATO + 0.40 SOL — и растёт线性но с `minted_count` (при minted=1000 только один Legendary-крафт = 52 000 WOOD). Reroll обходит весь слой сжигания ресурсов целиком | Ввести плату ресурсами в `reroll`, привязать к `rarity_counter` или ввести свой счётчик; либо сделать `reroll` authority-only с серверной валидацией |
| **F-10** | 🟠 **High** | CORE `MarketplaceList` (`lib.rs:1561`), `AuctionCreateCtx` (`lib.rs:1648`) | Оба используют `init` на seeds `[LISTING_SEED, mint]` / `[AUCTION_SEED, mint]` и **никогда не закрывают** PDA (`buy_handler` ставит `active=false`, `cancel_handler` — тоже; `settle_handler` — тоже). Повторный `init` на существующий аккаунт невозможен | 1. Игрок выставляет топор, снимает с продажи (`marketplace_cancel`). 2. Пытается выставить снова → `init` падает, аккаунт занят. **NFT теряет ликвидность навсегда.** То же для аукциона: один аукцион на NFT на всё время жизни | Использовать `init_if_needed` + реинициализацию полей, либо добавить `close = seller` в `buy`/`cancel`/`settle`, либо включать в seed инкрементный `nonce`/`list_id` |
| **F-11** | 🟠 **High** | CORE `collect_well_water` (`collect_well_water.rs`) + `constants.rs` WELL_RATE_* | Бесплатный кран воды: 5/15/20 WATER в час по погоде, окно накопления 24 ч → **120–480 WATER в сутки на кошелёк**, ожидаемое 216. Ни энергии, ни ресурсов, ни кулдауна. issuance-капа нет | Создать 1000 кошельков, один раз вызвать `collect_well_water` для инициализации, далее собирать по 216 000 WATER/сутки и пересылать на основной кошелёк. За год — 78.8 млн WATER, себестоимость = rent + gas | Привязать кран к `Player`/энергии/наличию активного инструмента; ввести глобальный кап на WATER; учесть, что `WELL_MAX_ACCRUAL_SECONDS` ограничивает один сбор, но не частоту |
| **F-12** | 🟠 **High** | CORE `upgrade_exploration_tier` (`exploration.rs:139`) | На свежем аккаунте `ExplorationState.tier == 0` → `EXPLORATION_UPGRADE_COST_PER_TIER[(state.tier - 1)]` = индекс `-1` → **underflow u8 → panic** (в workspace `overflow-checks = true`). Второй момент: `start_exploration_commit` отключён (`require!(false)`), поэтому `tier` всё равно никогда не станет 1 | Любой вызов `upgrade_exploration_tier` новым игроком аварийно завершается. Если бы не падал — игрок сжигал бы WOOD/STONE/FOOD за тир, который нельзя использовать | `require!(state.tier >= 1)` + `init` tier=1 в явной инструкции создания; либо закрыть инструкцию вместе с exploration |
| **F-13** | 🟠 **High** | QST `drum_reveal.rs:10` | Таблица `DRUM_PRIZES` даёт математическое ожидание **40 маскотов при цене спина 5** → 8-кратный перерасход казны (0.4·10 + 0.3·25 + 0.2·50 + 0.09·150 + 0.01·500 = 40). `drum_commit` отключён, `drum_reveal` — нет | Пока недостижимо (нет коммитов). Но это готовая «печатная машинка»: при снятии флага один спин = −35 маскотов из казны. Плюс та же проблема F-06: секрет держит authority | Пересчитать таблицу под EV ≤ 1× цены; до этого не снимать флаг |
| **F-14** | 🟡 **Medium** | CORE `claim_season_reward` (`season.rs:81`) | `reward_amount = (level as u64) * 100` — **без `RESOURCE_UNIT`**. Все остальные суммы в программе в атомарных единицах (1e9). Максимальная награда 42 уровня = 4200 атомарных = **0.0000042 WOOD** | Формально сезонные награды существуют, фактически это пыль. Комментарий в коде сам признаёт «пример; конкретные награды — продуктовое решение» | Умножить на `RESOURCE_UNIT` и/или вынести таблицу наград в конфиг-аккаунт |
| **F-15** | 🟡 **Medium** | CORE `adjust_player_capacity` (`lib.rs:951`) | Authority-only, но без границ: `delta: i32` и `has_tent: bool` применяются к **любому** `player`. `delta = -6` → `villagers = 0` → `start_mining` навсегда возвращает `NoIdleVillagers`. Сбросить может только тот же authority | Гриф на конкретного игрока или массовый «бракинг» неугодных; полная зависимость гейта прогрессии от бэкенда | Ограничить `|delta|`, запретить уводить `villagers` ниже уже занятых, эмитить событие с `previous/next` |
| **F-16** | 🟡 **Medium** | CORE `collector_stake.rs:18` | `require!(false, CollectorNotConfigured)` — перки Historian/Medallion **недостижимы**. Следовательно `player.historian_count`/`medallion_count` всегда 0 → мертвы `MINT_FEE_MEDALLION_*`, `MINT_FEE_HISTORIAN_*`, `MINT_FEE_BOTH_*`, `REFERRAL_MEDALLION_BONUS_CAP`, `REFERRAL_HISTORIAN_BONUS_CAP`; реферальный кап всегда 5 | Документация (`investors-ext.ts`) и `docs` описывают перки как часть экономики. `collector_unstake` при этом остаётся живым и вызываемым | Либо настроить канонические mint коллекций и включить, либо удалить мёртвые ветки из констант, IDL и фронтенда |
| **F-17** | 🟡 **Medium** | CORE `harvest_wheat.rs:24` vs `exploration.rs` (`lib.rs:1212`) | Несогласованная типизация: майнинг и жатва сравнивают `eq_ignore_ascii_case`, exploration требует **точное** совпадение `tool.tool_type == "Bow"`. `"Spear"` (1 из 3 типов в `PACK_TOOL_TYPES`) не майнит (`resource_mint_for_tool` → `None`), не Reaper, не Bow → **нулевая полезность** | Инструмент со `tool_type="spear"` или `"bow"` (строчная) бесполезен и не подлежит починке. `mint_tool` принимает любую строку до 32 символов, валидации нет | Ввести versioned enum `ToolKind` вместо `String`; мигрировать существующие `ToolData` |
| **F-18** | 🟡 **Medium** | CORE `init_reroll_config`/`set_reroll_config` (`reroll_random.rs:16,25`) | В отличие от `pack_config.rs:11`, здесь **нет** `require!(odds[4] == 0)`. Конфиг reroll может давать Legendary напрямую из любого инструмента | Опечатка в конфиге → неограниченная генерация Legendary минуя всю экономику | Добавить `require!(odds_bps[4] == 0, …)` по аналогии с паками |
| **F-19** | 🟡 **Medium** | CORE пауза не全覆盖 | `config.paused` не проверяется в: `MarketplaceCancel` (нет `config` вообще), `OfferCancelCtx`, `CancelBuyOrder`, `CancelSellOrder`, `RentalEndCtx`, `RentalRevokeCtx`, `ClaimLotteryPrize`, `weather_crank`, `collect_well_water` (есть), `craft_order_fulfill` (есть config, но без `!paused`) | Экстренная остановка через `set_paused` не останавливает отмену ордеров, завершение аренды и клейм лотереи. При инциденте это пути утечки | Добавить `config` + `constraint = !config.paused` во все инструкции, меняющие состояние или двигающие деньги |
| **F-20** | 🟡 **Medium** | CORE `withdraw_gas` (`withdraw_gas.rs`) | После **каждого** вывода взводится `cooldown_until = now + 12h`. Пользователь не может вывести средства быстрее чем раз в 12 часов; частичный вывод съедает слот. `deposit_gas` округляет вниз (`lamports / 1000`) — суммы < 1000 lamports уходят в PDA без начисления | Депозит 0.5 SOL → один вывод в 12 ч. Средства заперты. Мелкие депозиты (< 0.000001 SOL) теряются | Разрешить вывод без кулдауна до суммы, не прерываемой « Fee»; начислять микросы с точностью до lamports; ввести явный «emergency withdraw» |
| **F-21** | 🟡 **Medium** | CORE `cancel_buy_order`/`cancel_sell_order` (`lib.rs:2273`, `2287`) | Нет `constraint = order.is_buy == <ожидаемая сторона>`. Maker с sell-ордером может вызвать `cancel_buy_order`: она посчитает `refund = price × amount_remaining` и спишет её с lamports PDA-ордера, затем `close = maker` вернёт остаток. При небольшой сумме операция пройдёт, а токены в `order_vault` останутся без владельца-подписанта | Зависший `order_vault` с токенами и рентой (восстановимо через повторный `place_sell_order` + `cancel_sell_order`, но это не документировано). При `refund > lamports` — panic | Добавить `constraint = order.is_buy @ …` / `constraint = !order.is_buy @ …` |
| **F-22** | 🟡 **Medium** | CORE `MintTool` (`lib.rs:385`) | `token_account` проверяется только по `mint` и `amount == 0` — **нет проверки owner**. `td.owner`/`td.operator` выводятся из владельца ATA. В `Reroll.new_mint` (`lib.rs:616`) отсутствует `decimals == 0` (в `MintTool` и `Craft` он есть) | Authority может «вручить» инструмент любому кошельку без его согласия (спам/гриф). Reroll на mint с decimals > 0 создаст ToolData,claiming владение 1 атомарной единицей | Добавить `constraint = token_account.owner == recipient` (явный аргумент-получатель) и `decimals == 0` в `Reroll.new_mint` |
| **F-23** | 🟡 **Medium** | CORE `LotteryRound` | Нет инструкции закрытия/возврата. Если authority не раскрывает раунд, `pool_lamports` заперты в PDA навсегда; `LOTTERY_ROUND_SPACE` рента тоже теряется | См. F-06: «неудачный» исход → не раскрываем → деньги игроков заперты | Добавить `refund_lottery_round` по таймауту, либо закрывать раунд в `settle` |
| **F-24** | 🟡 **Medium** | CORE рента/аккаунт-блот | `Listing`, `Auction`, `LotteryRound`, `LotteryTicket` never closed. `RewardReceipt` — намеренно не закрывается (это правильно, есть комментарий). Но `listing_vault`/`auction_vault` ATA остаются привязанными к мёртвым PDA | Постоянно растущее число мёртвых аккаунтов; рента не возвращается | Закрывать PDA и ATA в settle/cancel/claim |
| **F-25** | 🟡 **Medium** | SK `SessionCheckAndSpend` (`session-keys/src/lib.rs:165`) | У `session` **нет `seeds`-констрейнта**, только `constraint = session.session_signer == session_signer.key()`. Нет и проверки owner (есть, через `Account<SessionToken>`), но PDA-привязка отсутствует | Подмена аккаунта сессии на другой, ожидающий того же `session_signer`. Инструкция сейчас отключена (`require!(false)` на строке 245) | Добавить `seeds = [SESSION_SEED, authority.key().as_ref()], bump` и явно передавать `authority` |
| **F-26** | 🟡 **Medium** | MKT `crank_market` (`aof-market/src/lib.rs:304`) | `(now - pool.last_trade_ts)` — при `now < last_trade_ts` (рассинхрон часов валидатора) underflow → panic. Вероятность низкая, но инструкция permissionless | Спам-кранк на «битом» пуле | `now.saturating_sub(pool.last_trade_ts)` |
| **F-27** | 🟡 **Medium** | BE `miningPayout` / `MINING_ENABLED` | `config.ts:54`: `MINING_ENABLED = !isProduction && process.env.MINING_ENABLED === 'true'` — майнинг **выключен в продакшене на уровне бэкенда**, но `collect_mining` на цепи **включён и вызывается напрямую** (нужны только `user`-подпись и стейкнутый инструмент) | Любой может обойти «backend mining запрещён» и майнить напрямую через RPC. Замечание уже есть в предыдущем аудите (блокер 6), но не закрыто | Если майнинг не готов — закрыть `start_mining`/`collect_mining` на цепи, а не только в API |
| **F-28** | 🔵 **Low** | CORE `mint_resource_once` (`lib.rs:296`) | `RewardReceipt` сидится **только** по `reward_id` (`seeds = [b"reward_receipt", reward_id]`), без получателя. Глобальное пространство имён: квитанция, созданная для кошелька A, навсегда блокирует этот ID для кошелька B | При коллизии/ошибке формирования ID один игрок блокирует награду другого (DoS, не кража) | Включить `recipient` в seed |
| **F-29** | 🔵 **Low** | CORE `craft_order` (`craft_order.rs:14`) | `create_handler` требует только `premium_lamports > 0`; `wood_needed`/`stone_needed` могут быть 0. Fulfiller получает премию, ничего не передав | Мошеннический/ошибочный заказ: премия уходит любому, кто вызовет `craft_order_fulfill` | Требовать `wood_needed + stone_needed > 0` |
| **F-30** | 🔵 **Low** | BE `apiKey.ts:6` | In-memory `usage: Map<string, number[]>` растёт бесконечно (ключ удаляется только фильтрацией внутри окна при обращении) | Медленная утечка памяти / DoS при массовой выдаче ключей | Периодическая сборка мусора или Redis |
| **F-31** | 🔵 **Low** | Зависимости | `anchor-lang 0.30.1` + `solana-program 1.18.26` — EOL-линейка (актуальная 1.0.x/2.x). `@solana/web3.js` заявлен как `^1.95.3` — диапазон допускает отозванные 1.95.6/1.95.7 (lockfile пинит безопасные 1.98.4, `arrayref` 0.3.9 < заражённого 0.3.10) | Риск только при перегенерации lockfile. **RUSTSEC-2026-0144 (`Program<'info, System>`) к 0.30.1 не относится** — он бьёт 1.0.0–1.0.1; проверено явно | Обновить до актуального Anchor/Solana; закрепить web3.js точной версией; запускать `cargo audit` + `npm audit` в CI |
| **F-32** | ℹ️ **Info** | FE `transactionIntent.ts:37` | Полная валидация намерения реализована **только** для `marketplace_buy`. Комментарий в коде честен: `return; // Other operations still use the existing guard policy, not full intent validation` | Подмена цены/лота для остальных ~80 инструкций не защищена на уровне намерения (только program allowlist) | Расширить `TransactionIntent` на все платные операции |
| **F-33** | ℹ️ **Info** | Тесты | 20 валидаторских тестов на 87 инструкций `aof-core` + 5 программ. Нет fuzzing, нет property-based тестов. Не покрыты: `repair`, `craft_recipe`, `referral`, `season`, well/bread-цепочка, `marketplace` relist, `rental`, `offer`, `pay_out`, LP | Регрессии ловятся выборочно | Минимум: довести покрытие до всех путей, двигающих деньги; добавить fuzzing для `mint_resource`/`orderbook` |

**Сводка по severity:** 🔴 Critical — 2 · 🟠 High — 11 · 🟡 Medium — 16 · 🔵 Low — 5 · ℹ️ Info — 2 (всего 36)

---

## 3. Экономическая модель

Симулятор: `audit/economy_sim.py` (запуск: `python3 audit/economy_sim.py`), полный вывод — `audit/economy_sim_output.txt`. **Все константы взяты напрямую из `aof-core/src/constants.rs` и инструкций**, ничего не экстраполировано. Единицы — «display units» (1 unit = `RESOURCE_UNIT` = 1e9 атомарных).

### 3.1 Проверено отдельно: погода честная

`weather_crank` использует `hash_val = (day_id × 0x9E3779B97F4A7C15) >> 32`, затем `% 100`. Прогон на 3650 днях даёт **DROUGHT 10.00% / SUNNY 50.05% / RAIN 30.05% / FESTIVAL 9.89%** — распределение соответствует заявленному, последовательность выглядит псевдослучайной. К погоде претензий нет. (Единственное: она полностью предсказуема наперёд, но это общая для всех «погода», а не лутбокс —acceptable.)

### 3.2 Таблица 2 — главный результат: P&L одного кошелька

6 инструментов (3 топора + 3 кирки), 20 ч/сутки на инструмент, ремонт до полной прочности:

| Редкость | ед./час | WOOD добыто | STONE добыто | −WOOD ремонт | −STONE ремонт | **НЕТТО WOOD** | **НЕТТО STONE** | Вердикт |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Common | 10.0 | 600 | 600 | 360 | 240 | **+240** | **+360** | прибыльно |
| Uncommon | 11.5 | 690 | 690 | 720 | 480 | **−30** | **+210** | смешанно |
| Rare | 13.0 | 780 | 780 | 1 680 | 1 080 | **−900** | **−300** | **убыточно** |
| Epic | 15.0 | 900 | 900 | 3 600 | 2 400 | **−2 700** | **−1 500** | **убыточно** |
| Legendary | 18.0 | 1 080 | 1 080 | 8 400 | 5 400 | **−7 320** | **−4 320** | **убыточно** |

Причина: `YIELD` растёт 10 → 18 (×1.8), а `REPAIR_WOOD_PER_UNIT` — 3 → 70 (×23.3), `REPAIR_STONE_PER_UNIT` — 2 → 45 (×22.5). Портфель 3 axe + 3 pick безубыточен по WOOD только при `Y > 2 × repair_wood`; выполняется **только для Common** (10 > 6).

### 3.3 Таблица 2b — lifetime-экономика одного инструмента

Ресурс прочности = 20 единиц = 20 часов майнинга за всё время жизни до ремонта.

| Редкость | Безубыточных ч/день | Lifetime добыча | Lifetime ремонт W / S | Lifetime нетто W |
|---|---:|---:|---:|---:|
| Common | любое H | 200 | 60 / 40 | **+140** |
| Uncommon | никогда | 230 | 120 / 80 | **+110** |
| Rare | никогда | 260 | 280 / 180 | **−20** |
| Epic | никогда | 300 | 600 / 400 | **−300** |
| Legendary | никогда | 360 | 1 400 / 900 | **−1 040** |

### 3.4 Таблица 1 — эмиссия по горизонтам (Common, 6 инструментов/кошелёк)

| Горизонт | Акторов | WOOD добыто | STONE добыто | −WOOD ремонт | −STONE ремонт | Чистый WOOD | Чистый STONE | Вода (faucet) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 30 | 1 | 18 000 | 18 000 | 10 800 | 7 200 | 7 200 | 10 800 | 6 480 |
| 30 | 100 сибилов | 1 800 000 | 1 800 000 | 1 080 000 | 720 000 | 720 000 | 1 080 000 | 648 000 |
| 30 | 1 000 сибилов | 18 000 000 | 18 000 000 | 10 800 000 | 7 200 000 | 7 200 000 | 10 800 000 | 6 480 000 |
| 90 | 1 | 54 000 | 54 000 | 32 400 | 21 600 | 21 600 | 32 400 | 19 440 |
| 90 | 1 000 сибилов | 54 000 000 | 54 000 000 | 32 400 000 | 21 600 000 | 21 600 000 | 32 400 000 | 19 440 000 |
| 365 | 1 | 219 000 | 219 000 | 131 400 | 87 600 | 87 600 | 131 400 | 78 840 |
| 365 | 1 000 сибилов | 219 000 000 | 219 000 000 | 131 400 000 | 87 600 000 | 87 600 000 | 131 400 000 | 78 840 000 |

**Сибил-ограничение:** `DEFAULT_VILLAGERS = 6` — жёсткий потолок на кошелёк (6 одновременных сессий). Но это **не** лимит на сибил: кошельков можно создать сколько угодно. Единственный барьер — получить Common-инструменты, а они добываются только через authority-only `mint_tool` (Common не крафтится: `Rarity::craft_index()` для Common = `None`). То есть майнинг де-факто **permissioned**; сибил-устойчивость определяется политикой раздачи администратора, а не кодом.

### 3.5 Таблица 3 — эскалация цены крафта (`base + minted_count × mult`)

| Редкость | minted=0 | minted=10 | minted=100 | minted=1 000 | minted=10 000 | mult/шт. |
|---|---:|---:|---:|---:|---:|---:|
| Uncommon | 100 | 110 | 200 | 1 100 | 10 100 | 1 |
| Rare | 150 | 170 | 350 | 2 150 | 20 150 | 2 |
| Epic | 500 | 600 | 1 500 | 10 500 | 100 500 | 10 |
| Legendary | 2 000 | 2 500 | 7 000 | 52 000 | 502 000 | 50 |

`FOOD / SEEDS / WATER / POTATO: mult = 0` — их цена **никогда** не растёт. Счётчик монотонен: сжигание инструмента его не уменьшает (замечание уже было в предыдущем аудите, блокер 3 — не закрыто).

### 3.6 Таблица 8 — две дорожки прокачки

| Ступень | craft: WOOD | STONE | FOOD | SEEDS | WATER | POTATO | gas SOL | reroll |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Uncommon | 100 | 100 | 50 | 20 | 10 | 10 | 0.10 | 2 предыдущих, 0.06 SOL |
| Rare | 150 | 120 | 80 | 40 | 30 | 20 | 0.10 | 2 предыдущих, 0.06 SOL |
| Epic | 500 | 400 | 300 | 150 | 100 | 100 | 0.10 | 2 предыдущих, 0.06 SOL |
| Legendary | 2 000 | 1 500 | 1 000 | 500 | 400 | 500 | 0.10 | 2 предыдущих, 0.06 SOL |
| **ИТОГО** | **2 750** | **2 120** | **1 430** | **710** | **540** | **630** | **0.40** | |

`reroll`: **0 ресурсов, authority не нужен, счётчик не трогается.** Common → Legendary = 16 Common, 15 вызовов, 0.90 SOL. При `minted_count = 1000` цена craft Legendary = 52 000 WOOD, а reroll Epic → Legendary остаётся 0.06 SOL + 2 Epic. **Связующая кривая обходится полностью.**

### 3.7 Таблица 7 — карта source / sink (только по коду)

| Ресурс | SOURCE | SINK |
|---|---|---|
| WOOD | `collect_mining`(axe); `mint_resource`(admin); `explore_reveal`(выкл.) | `repair`; `craft`; `start_baking`(топливо); `referral_upgrade` |
| STONE | `collect_mining`(pick); `mint_resource`(admin); `explore_reveal`(выкл.) | `repair`; `craft`; `start_milling`; `referral_upgrade` |
| **FOOD** | **только `mint_resource`(admin)** и `claim_season_reward` (пыль) | `craft`; `referral_upgrade` |
| **WATER** | **`collect_well_water` — бесплатный кран 120–480/сут на кошелёк**; `mint_resource` | `start_baking`; `craft` |
| SEEDS | `collect_mining`(reaper); `mint_resource` | `plant_seeds`; `craft` |
| WHEAT | `harvest_wheat` (SEEDS ×1.5) | `start_milling` |
| FLOUR | `collect_flour` | `start_baking` |
| **BREAD** | `collect_bread` | **НЕТ. Ни одна инструкция не сжигает BREAD.** |
| MEAT | `collect_mining`(bow); `mint_resource` | exploration (выкл.) → **sink = НЕТ** |
| COAL | **только `mint_resource`**; `COAL_DROP_CHANCE_BPS` не реализован в коде | `start_baking`(fuel_kind=1) |
| GEM* | только `craft_recipe` (**сломан**, см. F-04) | `craft_recipe` (сломан) |
| FLASK* | только `craft_recipe` (сломан) | `use_flask` **не скомпилирован** (нет в `mod.rs`) |
| LOVE_HEART | только `mint_resource`(admin) | **НЕТ** |
| POTATO | только `mint_resource`(admin) — внешний токен | `craft` |

### 3.8 Хлебная цепочка (таблица 4/6)

```
1.000 SEEDS -> 1.500 WHEAT -> 0.900 FLOUR -> 0.707 BREAD
попутно сжигается: 0.150 STONE, 0.579 WATER, 0.321 COAL
+ 2 энергии + 1 прочность Reaper
```

**BREAD нигде не расходуется.** Документация (`investors-ext.ts`, loops[0]) утверждает: «цикл замкнут на энергии: каждое действие стоит энергии, **хлеб и фляги возвращают её**». В коде энергия регенерируется **только** временем (`EnergyAccount::regenerate`, +1 за 30 мин, кап 20); ни хлеб, ни фляги к ней не привязаны. Файл `use_flask.rs`, который должен был это делать, не включён в `instructions/mod.rs` и ссылается на несуществующий тип `PlayerState` — он даже не компилируется.

Итог: хлебная цепочка — это **чистый уничтожитель стоимости**: игрок сжигает SEEDS/STONE/WATER/COAL/энергию/прочность и получает токен с нулевым спросом.

### 3.9 Сценарии

| Сценарий | Что происходит |
|---|---|
| **Одиночный игрок, 30 дней** | +7 200 WOOD / +10 800 STONE нетто (Common). Любая прокачка выше Uncommon уводит P&L в минус. Рациональная стратегия — **не прокачиваться** |
| **Активный фармер, 90 дней** | Накапливает ресурсы, которые некуда девать: крафт убыточен по P&L, хлебная цепочка сжигает стоимость, ремонт Rare+ отрицательный. Единственный выход — продажа на ордербуке |
| **Сибил 100 / 1 000 кошельков, 365 дней** | 21.9–219 млн WOOD нетто; кран воды 0.79–7.9 млн WATER/год. Никакого on-chain ограничения. Сдерживается только тем, что Common-инструменты выдаёт администратор |
| **Кит-выход** | Ордербук — обычный лимитный стакан без AMM, без оракула цены, без circuit breaker. Кит выставляет sell-ордер по любой цене; защит нет. Позитив: отсутствие оракула = **нет и вектора манипуляции оракулом**. Негатив: нет и ликвидности/прайсинга |
| **Гиперинфляция** | Эмиссия линейна по (число кошельков × время), sinks привязаны к активности и **отрицательны по нетто для высоких редкостей**. Долгосрочно: цена ресурсов → 0, при этом прокачка экономически бессмысленна. Дефляционной спирали не будет — будет «мусорная» инфляция с мёртвым спросом |
| **Казна / runway** | Источники: 0.1 SOL за крафт, 0.06 SOL за reroll, 0.01 SOL за unstake, 3–5% с рыночных сделок, 0.15 SOL за сезонный пропуск, 30% с лотереи. При 1 000 сибилах и 12 крафтах/год = 1 200 SOL/год — но это при 1 000 активных кошельков, которых нет. **Фактический баланс казны не проверялся** (нет ончейн-доступа). Оценить runway невозможно |

---

## 4. Оценка кибербезопасности

### 4.1 Модель угроз

| Актёр | Бюджет / доступ | Что может получить | Ограничено ли? |
|---|---|---|---|
| **A1. Игрок (прямой RPC)** | Любой кошелёк, свой gas | `start_mining`/`collect_mining` (обход backend-флага, F-27), `reroll` (обход кривой крафта, F-09), `collect_well_water` (кран, F-11), `harvest_wheat`/`mill`/`oven`, ордербук, `deposit_gas` | Нет. Ни один из этих путей не требует authority |
| **A2. Фронтраннер / сэндвич** | Свой валидатор или Jito-бандл | На `marketplace_buy` защита есть: `marketplace_buy_bounded(max_price, expires_at)` + локальный intent во фронтенде. На **остальных** операциях защиты нет (F-32): подмена цены аукциона в полёте, снайпинг ордербука, перехват `offer_accept` | Частично (только marketplace) |
| **A3. Сибил-фермер** | N кошельков | Кран воды (F-11), майнинг (есть Common-инструменты) | Тemporarily — пока администратор не раздаёт инструменты |
| **A4. Компрометация хот-кея бэкенда** | Один env-файл / RCE на бэкенде | **Всё:** mint ресурсов до капа, mint инструментов, `pay_out` (кража всех застейканных NFT), `sweep_gas_fees` (все GasTank'и), `set_paused`, `grant_season_xp`. Ротация невозможна (F-02) | **НЕТ** — это и есть главный риск |
| **A5. Компрометация `ADMIN_TOKEN`** | Один HTTP-токен | Ops-эндпоинты бэкенда: relay транзакций, mint, init caps, circuit breaker. `timingSafeEqual`, минимум 32 символа, fail-closed если не задан — реализовано корректно | Да, частично. Нет rate-limit на число попыток → брутфорс |
| **A6. Инсайдер / команда (rug)** | Законный authority | Полностью легальный вывод через `pay_out`; заморозка через `set_paused`; смена `set_resource_mints` на подконтрольные mint'ы | **НЕТ.** Honeypot-паттерн присутствует в чистом виде |

### 4.2 Сверка с чек-листом Neodyme / Sealevel

| Паттерн | Статус | Примечание |
|---|---|---|
| Missing signer check | ✅ | Всех мутирующих инструкций signer'ы объявлены; есть `user` + `authority` там, где нужно |
| Missing owner check | ✅ | `Account<T>` везде; `UncheckedAccount` снабжены `address = …` |
| Type cosplay | ✅ | Anchor-дискриминаторы везде, «сырых» структур нет |
| Account substitution | ⚠️ | В целом закрыто `seeds`/`address`. Исключения: `SessionCheckAndSpend` (нет seeds, F-25), `MintTool.token_account` (нет owner, F-22) |
| Arbitrary CPI | ✅ | Все CPI идут в `Program<'info, Token>` / `system_program`; `check-mint-writable.py` + allowlist во фронтенде |
| PDA validation / canonical bump | ✅ | `seeds` + `bump = x.bump` повсеместно; `initialize` привязан к `ProgramData` |
| Account reinitialization / revival | ⚠️ | `init` (не `init_if_needed`) там, где критично (`RewardReceipt` — с пояснением, почему не закрывается). Но есть обратная проблема: **незакрываемые** `Listing`/`Auction` (F-10) |
| Duplicate mutable accounts | ✅ | Не найдено exploitable. `reroll` с `mint_a == mint_b` гаснет на втором burn (amount уже 0) |
| Integer overflow / underflow | ⚠️ | `overflow-checks = true` + `checked_*` почти везде. Найденные: `upgrade_exploration_tier` (F-12), `crank_market` (F-26), `(amount as u64) * cost` в `repair.rs:18` (безопасно по диапазону, но без checked) |
| Rounding в чью пользу | ✅ | `pro_rata`/`shares_for_deposit` в LP правлены корректно (floor, u128, есть property-тест round-trip) |
| lamports vs tokens / decimals | ⚠️ | `deposit_gas` округляет вниз (F-20); `claim_season_reward` забыл `RESOURCE_UNIT` (F-14) |
| Oracle manipulation | ✅ N/A | Оракулов цены нет вообще |
| RNG manipulation | 🔴 | F-06. `SlotHashes` + секрет authority + отсутствие обязательного settlement |
| Front-running | ⚠️ | Закрыт только для `marketplace_buy` (F-32) |
| DoS / compute / account bloat | 🟡 | F-24 (незакрываемые PDA), F-30 (утечка Map) |
| Centralization / SPL of failure | 🔴 | F-02, F-01 |
| Governance / timelock | 🔴 | Отсутствует полностью. Нет даже инструкции смены authority |

### 4.3 Что сделано **хорошо** (важно не только ругать)

- `initialize()` во всех 6 программах привязан к **каноническому `ProgramData` upgrade authority** — это закрывает классический «первый вызвавший становится админом». Сделано грамотно, с поясняющими комментариями.
- `IssuanceCap` спроектирован по-взрослому: fail-closed, «нет PDA = нет лимита, а не безлимит», эпоха не банкуется при пропуске, `set` не сбрасывает счётчик, есть property-тесты на 1000 эпох и `u64::MAX`.
- `RewardReceipt` — постоянный PDA, `init` (не `init_if_needed`), намеренно не закрывается, с объяснением почему. Правильное решение для replay-protection.
- `EnergyAccount::regenerate` — после предыдущего аудита (AOF-08) переписан с клампом и без «банкинга» регена; есть тесты на 256 интервалов и откат часов.
- LP-арифметика (`shares_for_deposit`, `pro_rata`) — u128, multiply-before-divide, тест «round-trip не может вытащить чужой резерв».
- `MarketplaceBuy` — старый дискриминатор намеренно оставлен возвращать `FeatureDisabled`, новый требует подписанные `max_price` + `expires_at` ≤ 300 с, плюс локальный intent-чек во фронтенде с точным списком аккаунтов. Это образцовая защита от подмены цены.
- Сайт/UI честно публикуют статус «soon» с именем инструкции и причиной для каждой отключённой механики.
- Секреты в git не найдены: `gitleaks.toml`, allowlist на публичные ключи, `.gitignore` закрывает keypair'ы. Проверено по всем отслеживаемым файлам.

---

## 5. Расхождения и мусор в проекте

| # | Тип | Где | Суть |
|---|---|---|---|
| G-01 | Документация vs код | `frontend/src/site/content/investors-ext.ts` | «Хлеб и фляги возвращают энергию» — не реализовано (`use_flask` не скомпилирован) |
| G-02 | Документация vs код | `frontend/src/site/content/potato.ts` | «POTATO нельзя купить внутри AOF… не выдаётся как награда» — но `mint_resource(ResourceKind::Potato)` существует; «10 POTATO + 1 Love Heart = 50 SKR» не реализовано нигде |
| G-03 | Документация vs код | `docs/ISSUANCE_CAPS_DESIGN.md` | Кап продаётся как защита от безлимитной эмиссии authority; покрывает 2 из 9 минтящих путей (F-03). План «перевести authority на Squads» невыполним (F-02) |
| G-04 | Документация vs код | `ANALYSIS.md` | Помечает паки/кузницу/лотерею/Hot Market как «Готово» — все отключены `require!(false)` |
| G-05 | Документация vs код | `frontend/src/site/content/trade.ts:86`, `investors-ext.ts` | «Шесть способов торговли» — `aof-market` полностью отключён (`TradingDisabled` в 3 из 4 торговых инструкций) |
| G-06 | Дублирование | `mint_resource.rs:12` и `burn_resource.rs:9` | Две копии `mint_for_kind()`; разойдутся при первой правке |
| G-07 | Дублирование | `randomness.rs:20` и `aof-quests/.../drum_reveal.rs:64` | Две копии `get_slot_hash()` |
| G-08 | Дублирование | `craft.rs:172` и `reroll.rs:65` | Одинаковый блок инициализации `ToolData` |
| G-09 | Мёртвые поля | `state.rs` — 12 структур | `buff_expires_at: i64` + `buff_type: u8` прикручены к `PackConfig`, `RerollConfig`, `Season`, `MaterialMints`, `EnergyAccount`, `FarmTile`, `WeatherState`, `WellState`, `MillState`, `OvenState`, `LoveProgress`, `FortuneBoost`. Читает/пишет их ровно один **нескомпилированный** файл |
| G-10 | Мусор в git | 59 файлов (из 623 отслеживаемых, ~9.5%) | `*.bak.<timestamp>` в `.gitignore` не попадают (шаблон `*.bak` не матчит `x.rs.bak.123`). В том числе **целое дерево** `programs/aof-market/src.bak.1788647091/` со старой, более слабой версией программы. Плюс 2 дубля `Anchor.toml.bak.*` |
| G-11 | Дублирующийся фронтенд | корневой `package.json` | Живой CRA-приложение (`react-scripts 5`, `firebase`, `ethers`, `openai`) рядом с настоящим Vite-фронтендом. `firebase.json` указывает на `functions/`; `functions/index.solana.js` — legacy-поверхность |
| G-12 | TODO/HACK в продакшене | `season.rs:80` | «пример; конкретные награды по уровням — продуктовое решение… в реальном проде вынести в конфиг» — не вынесено (F-14) |
| G-13 | Незавершённая логика | `migrate_tool.rs:31` | «tool_data.owner intentionally NOT set to a real user — migration script must later update»; инструмент минтится в vault с `staked = true` и `owner = vault`. Скрипта миграции нет |
| G-14 | Путаница в терминах | `constants.rs:241` | `LOTTERY_TICKET_PRICE_LAMPORTS = 800_000` с комментарием «~$0.08*100=$0.8?» — вопросительный знак в исходнике |

---

## 6. Неиспользуемые функции и устаревшие инструкции

### 6.1 Инструкции, отключённые `require!(false)` (но остаются вызываемыми по RPC)

| Программа | Инструкция | Файл:строка | Комментарий |
|---|---|---|---|
| CORE | `pack_open_commit` | `pack_open_commit.rs:16` | Escrow есть, путь возврата есть, но VRF нет |
| CORE | `reroll_random_commit` | `reroll_random.rs:35` | Инструмент сжигается до раскрытия, пути возврата нет |
| CORE | `start_exploration_commit` | `exploration.rs:17` | То же: 4 ресурса сжигаются до раскрытия |
| CORE | `forge_attempt_commit` | `forge.rs:25` | То же |
| CORE | `buy_lottery_ticket` | `lottery.rs:30` | Нет on-chain дневного лимита |
| CORE | `collector_stake` | `collector_stake.rs:18` | Нет канонических mint коллекций |
| CORE | `marketplace_buy` | `lib.rs:2791` | Старый дискриминатор, намеренно fail-closed |
| RBT | `do_rebirth` | `do_rebirth.rs:39` | Сброс прогресса не атомарен |
| SK | `session_create` | `session-keys/src/lib.rs:211` | Предварительная резервация не связана с целевой инструкцией |
| SK | `session_check_and_spend` | `session-keys/src/lib.rs:245` | Только резервирует счётчик, не доказывает целевой CPI |
| QST | `achievement_unlock` | `achievement_unlock.rs:33` | Self-attestation achievements |
| QST | `challenge_contribute` | `challenge_contribute.rs:43` | Форджабельный прогресс |
| QST | `drum_commit` | `drum_commit.rs:52` | Нет expiry/refund |
| MKT | `hot_market_buy` / `hot_market_sell_into_queue` / `place_limit_order` | `aof-market/src/lib.rs:276, 285, 335` | `TradingDisabled` |

**Риск «осиротевших» инструкций:** все они остаются в бинарнике и доступны прямому RPC-вызову. Комментарии в `aof-market` это прямо признают: «Argument names are preserved for IDL stability, so every argument is intentionally unused». Это корректная тактика (сохранить ABI), но она означает, что при снятии флага инструкция должна быть переписана, а не «включена».

### 6.2 Инструкции, живые, но фактически неработоспособные

| Инструкция | Причина |
|---|---|
| `craft_recipe` | mint-аккаунты без `mut` → все 8 рецептов revert (F-04) |
| `upgrade_exploration_tier` | underflow на свежем аккаунте (F-12) |
| `quest_claim_reward` | **Не существует ни одной инструкции, создающей `QuestProgress`** — PDA гарантированно отсутствует → клейм невозможен. Весь квестовый слой `aof-quests` мёртв |
| `collector_unstake` | Нет застейканных коллекционеров (F-16), инструкция жива |
| `drum_reveal` | Нет коммитов (F-13), инструкция жива |
| `claim_lottery_prize`, `draw_lottery`, `commit_lottery_draw` | Билеты не продаются, инструкции живы (F-06, F-23) |
| `hot_market_skip` | Emit-only no-op, permissionless → спам событий |

### 6.3 Мёртвый код и нескомпилированные файлы

| Объект | Где | Статус |
|---|---|---|
| `use_flask.rs` (весь файл) | `aof-core/src/instructions/use_flask.rs` | **Не включён в `instructions/mod.rs`**, ссылается на несуществующий `PlayerState` → не компилируется. Никакой инструкции `use_flask` в `#[program]` нет |
| `LoveProgress`, `FortuneBoost` | `state.rs` | Структуры + `*SPACE` константы, ни одного использования |
| `EnchantSlotType` enum | `state.rs` | Ни одного использования |
| `Rarity::income_multiplier()` | `state.rs:119` | Ни одного использования (значения 1/2/4/8/16 не совпадают с `YIELD_BPS_*` 10000/11500/… — две разные кривые доходности в одном файле) |
| `COAL_DROP_CHANCE_BPS` | `constants.rs` | Заявлен дроп угля у шахтёра 15% — **не реализован** |
| `SKR_MIN_BALANCE`, `SKR_CRAFT_DISCOUNT_BPS` | `constants.rs` | Скидка 15% на POTATO fail-closed (см. комментарий в `craft.rs:30`), константы мертвы |
| `LOTTERY_MAX_TICKETS_PER_DAY` | `constants.rs` | Не используется (билеты отключены именно поэтому) |
| `skr_mint`, `user_skr` | `Craft` (`lib.rs:571`) | Аккаунты в контексте «для совместимости IDL», не читаются |
| `EnergyDepleted`, `LoveHeartNotTransferable`, `FortuneBoostExpired`, `RecipeNotFound`, `MaterialNotRegistered` и ещё 7 вариантов | `errors.rs` | Из 101 варианта `AofError` **13 не используются нигде**: `ToolIsMining`, `InvalidMiningHours`, `ReferralAlreadyBound`, `LotteryDailyLimitReached`, `EnergyDepleted`, `FortuneBoostExpired`, `FortuneBoostAlreadyActive`, `LoveHeartNotTransferable`, `InvalidWeatherSeed`, `InvalidReveal`, `AlreadyRevealed`, `InvalidFlaskType`, `EnergyCapExceeded` |
| `Anchor.toml.bak.*`, `create_session_keys.sh.save` | корень | Дубли |
| `resp_idl.md` (1435 строк), `AOF_EXPANSION_FULL_SOURCE.md` (5443 строки) | корень | Дампы, сгенерированные ИИ, закоммичены в репо |

### 6.4 Устаревшие API

- `anchor-lang 0.30.1` / `solana-program 1.18.26` — EOL-линейка (F-31).
- `bs58 ^5.0.0` в бэкенде против `^6.0.0` в корне — рассинхронизация мажорных версий одного пакета в монорепе.
- Корневой `package.json` тянет `react-scripts 5` (webpack 4/5, масса транзитивных уязвимостей) при живом Vite-фронтенде.

---

## 7. Итоговое мнение аудитора

### Вердикт: **НЕ ГОТОВ К MAINNET. нужен рефакторинг архитектуры полномочий и пересборка экономики.**

Общий риск-рейтинг: **HIGH (7/10)** — с потенциалом перехода в CRITICAL при появлении реальных пользовательских средств.

**Что блокирует запуск (must-fix):**

1. **F-01 + F-02** — единый не ротируемый authority с правом вывода любых токенов из vault. Это не «риск», это готовая точка отказа. Пока не будет multisig + отдельного mint-делегата + timelock, любые деньги в системе — заложники одного env-файла.
2. **F-08** — экономикаcore-loop'а арифметически убыточна с Rare. Запуск с такой кривой = игроки обнаруживают это за неделю и уходят, либо (что хуже) вся активность концентрируется на Common и связующая кривая крафта остаётся мёртвой.
3. **F-03** — «кап эмиссии» не кап. Нельзя продавать инвесторам/игрокам scarcity, которой нет в коде.
4. **F-04/F-05** — сломанная фича, проведённая端到端, плюс CI-гейт, который её не видит. Это симптом: гейты дают ложную уверенность, значит на них нельзя полагаться и в остальном.
5. **F-06** — любая платная случайность на секрете authority. Либо VRF, либо признать публично, что механики нет.

**Что можно запускать уже сейчас (если очень нужно):** закрытый devnet-soak с фейковыми деньгами, с отключённым `pay_out`, с ручной раздачей инструментов и с мониторингом P&L. Это даст реальные данные для калибровки — сейчас их нет, а калибровать константы «на глаз» уже пытались и получили F-08.

**Оценка зрелости по компонентам:**

| Компонент | Оценка | Комментарий |
|---|---|---|
| Качество Rust-кода | 7/10 | Аккуратно, комментарии объясняют «почему», checked-арифметика, есть unit-тесты |
| Безопасность аккаунтов | 7/10 | Классические Solana-дыры закрыты; дыра в полномочиях, не в аккаунтах |
| Экономика | 2/10 | Кривая ремонта перевёрнута, кап не кап, reroll обходит sinks, BREAD без sink |
| RNG / честность | 3/10 | Отключено — это правильно, но reveals живы, а лотерея полностью на доверии |
| Бэкенд | 6/10 | Wallet-proof и idempotency сделаны сильно; API-ключи на `Math.random` — провал |
| Фронтенд | 7/10 | Intent-валидация только для одной операции, но сайт честен про статусы |
| Инженерная гигиена | 4/10 | 59 .bak-файлов в git, два параллельных фронтенда, мёртвый код |
| Готовность к продакшену | **2/10** | Предыдущий аудит (2026-09-20) уже дал NO-GO; все 9 его блокеров остаются открытыми |

---

## 8. Ограничения аудита

**Что было проверено:** весь Rust-код 6 программ (5306 LOC) построчно; бэкенд — ключевые middleware (`adminAuth`, `apiKey`, `walletProof`, `security`), конфигурация, provider, secret store, маршруты mint/chain; фронтенд — signing boundary, intent-валидация, контент сайта; IDL; конфиги деплоя; документация; зависимости по `Cargo.lock` и трём `package-lock.json`.

**Что НЕ проверено и почему:**

1. **Ончейн-состояние.** Не было RPC/эксплорер-доступа. Не проверены: реальный `upgrade authority` каждой из 6 программ, является ли он multisig; фактическое значение `Config.authority` и `Config.treasury`; является ли auth-PDA реальным mint authority задеплоенных минтов; есть ли у ресурсных минтов freeze authority; кто держит mint authority ресурсных минтов и может ли команда его отозвать; баланс казны. **Все выводы о «кто владеет ключом» — о коде, не о деплое.** Это критично: пункт 1 блокеров предыдущего аудита так и не закрыт.
2. **Деплоенный байткод.** Rust в этой среде не собирался (нет `cargo`/`anchor`/`solana`, `rustup` недоступен). Утверждения о поведении инструкций основаны на исходниках и на знании семантики SPL Token/Solana runtime. Утверждение «`craft_recipe` упадёт» — высоконадёжное (рантайм отклоняет запись в read-only аккаунт), но **не подтверждено прогоном на валидаторе**.
3. **Верифицированная сборка.** Нет `anchor build` → нет проверки, что деплоенный `.so` соответствует этому исходнику.
4. **Фаззинг/хаос-тесты.** 20 валидаторских тестов прочитаны, но не запускались. Fuzzing отсутствует в проекте.
5. **Приватные/внешние части.** Приватного репозитория бэкенда нет в доступе; `functions/` (legacy Firebase/Ronin) не аудировался (это承认о и в предыдущем аудите).
6. **История git.** Проверены только имена файлов и текущее содержимое. Полный `gitleaks` по истории с редактированием вывода не запускался — рекомендуется (предыдущий аудит, блокер 8).
7. **Нагрузка, PostgreSQL, multi-instance, бэкапы.** Не проверялись.
8. **Цены и оракулы.** Их нет в системе, поэтому «оценка стоимости ресурсов» в §3 дана в натуральных единицах, а не в деньгах. Перевод 1 SOL = $100 взят из комментария в `constants.rs`, а не из рынка.

**Запрос к заказчику для закрытия пробелов:** (а) адреса 6 программ + `solana program show` по каждому; (б) значение `Config.authority`, `Config.treasury`, `MaterialMints` с деплоя; (в) `solana account` по ресурсным минтам (mint/freeze authority, supply); (г) логи/история транзакций `aof-core` с devnet; (д) доступ к CI с рабочим Anchor/validator для запуска `tests/aof_core.ts`.
