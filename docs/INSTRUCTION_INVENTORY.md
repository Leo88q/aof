# Инвентарь инструкций AOF

Файл создаёт `node scripts/instruction-inventory.mjs --write`; гейт — `--check` (его же зовёт `tests/readiness/instruction-inventory.test.cjs`).
Машинная версия — [`INSTRUCTION_INVENTORY.json`](INSTRUCTION_INVENTORY.json); ручная классификация — [`security/instruction-roles.json`](../security/instruction-roles.json).

> Поиск call sites **статический и текстовый**: он указывает, где смотреть, и не доказывает «вызывается» или «не вызывается»
> (имена из одного слова — `craft`, `stake`, `reroll` — дают случайные совпадения). Удалять код по этому списку нельзя:
> сначала нужны доказательство отсутствия всех call sites и тест на замещающий путь.

## Итоги

| Программа | Инструкций | Отключено в коде | Задеты validator-тестами (статически) | Без call sites* | Без call sites и тестов* |
|---|---:|---:|---:|---:|---:|
| aof_core | 124 | 4 | 92 (74%) | 12 | 1 |
| aof_market | 14 | 1 | 4 (29%) | 2 | 1 |
| aof_quests | 19 | 4 | 0 (0%) | 7 | 6 |
| aof_rebirth | 5 | 0 | 2 (40%) | 0 | 0 |
| aof_liquidity | 6 | 0 | 0 (0%) | 0 | 0 |
| aof_session_keys | 6 | 2 | 0 (0%) | 4 | 0 |
| **всего** | **174** | **11** | **98** (56%) | **25** | **8** |

\* без инструкций с общими именами. «Задеты validator-тестами» — статический подсчёт вызовов `<получатель>.methods.<имя>(` в `tests/*.ts`. Динамический замер CU
(`tests/aof_cu_report.ts`, только aof_core, только успешные транзакции) может дать другое число; он остаётся авторитетным для CU.

Про «66 из 120»: по условию задачи динамический замер (`anchor test`, CU-отчёт) задел 66 из 120 инструкций aof_core — это число здесь НЕ измерено
(нет `solana-test-validator`). Статический подсчёт выше для aof_core больше, потому что имя в тесте может стоять в негативном кейсе, который ничего не
исполняет успешно. Точный список расхождений даёт `node scripts/instruction-inventory.mjs --compare-cu target/cu-report.md` после `anchor test`.
Для aof_quests, aof_liquidity и aof_session_keys validator-тестов в `tests/*.ts` нет вообще — их покрывают только Rust-тесты, самотесты и readiness.

## Роли

| Роль | aof_core | aof_market | aof_quests | aof_rebirth | aof_liquidity | aof_session_keys | всего |
|---|---:|---:|---:|---:|---:|---:|---:|
| gameplay | 80 | 4 | 9 | 1 | 2 | 4 | 100 |
| admin | 21 | 5 | 7 | 3 | 3 | 1 | 40 |
| emergency | 6 | 1 | 1 | 0 | 0 | 0 | 8 |
| migration | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| initialization | 8 | 2 | 2 | 1 | 1 | 1 | 15 |
| compatibility | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| deprecated | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| candidate-dead-code | 0 | 2 | 0 | 0 | 0 | 0 | 2 |

## Отключены в коде (11)

Первая команда обработчика — `require!(false, …)` или `err!(…)`: инструкция есть в IDL, но на цепи всегда отказывает.

| Инструкция | Роль | Заметка |
|---|---|---|
| aof_core.marketplace_buy | deprecated | Всегда FeatureDisabled: заменена marketplace_buy_bounded (с max_price и сроком); остаётся ради стабильности IDL. |
| aof_core.migrate_tool | migration | Легаси-миграция инструментов завершена и отключена: минт шёл в vault без шага выдачи игроку. |
| aof_core.purchase_season_pass | gameplay | Покупка платного сезонного пропуска — отключена (SeasonPremiumRequired) до приёмочного гейта 42 дня / 0.15 SOL. |
| aof_core.rental_start | deprecated | Всегда FeatureDisabled: заменена rental_start_bounded (с потолком комиссии); остаётся ради стабильности IDL. |
| aof_market.place_limit_order | candidate-dead-code | Лимитные ордера отключены: нет инструкции матчинга и расчёта (TradingDisabled); аргументы сохранены ради IDL. |
| aof_quests.achievement_unlock | gameplay | Отключена: нельзя самозаявлять достижение без критериев и доверенного верификатора. |
| aof_quests.challenge_contribute | gameplay | Отключена: нет дебета канонического mint медалей и пути расчёта; ждёт экономической спецификации. |
| aof_quests.drum_commit | gameplay | Отключена (Paused): константы — сырые атомы, а не 5 целых единиц проверенного Potato-mint. |
| aof_quests.potato_spin_commit | gameplay | Отключена до подписанного devnet-прогона, VRF-смоков и независимого одобрения релиза. |
| aof_session_keys.session_check_and_spend | gameplay | Отключена (AtomicBindingRequired): резервирование не привязано к целевой инструкции в одной транзакции. |
| aof_session_keys.session_create | gameplay | Отключена (AtomicBindingRequired): сессию нельзя выдавать, пока нет атомарной привязки к тратам. |

## Без найденных call sites (25)

Не «мёртвый код», а список мест для ручной проверки. «Тесты» — есть ли хоть одно покрытие (validator / самотест / readiness / Rust).
Инструкции с общими именами (23: ротация authority, set_fees, set_paused, vrf_pool_*) исключены: по тексту нельзя определить, какой программе принадлежит упоминание.

| Инструкция | Роль | Статус | Тесты | Заметка |
|---|---|---|---|---|
| aof_core.burn_tool | gameplay | active | validator, selfTests, readiness | Сжигание инструмента; клиентского call site нет, покрыт validator-тестом — перед любой правкой проверить продуктовый путь. |
| aof_core.match_resource_orders | compatibility | active | validator, readiness, rust | Матчинг ордербука v1; новый код использует match_resource_orders_v2 (цена за целый ресурс, эскроу с округлением вверх). Обработчик активен. |
| aof_core.place_buy_order | compatibility | active | validator, readiness | Размещение ордера v1; новый код использует place_buy_order_v2. Обработчик активен — ждёт решения владельца. |
| aof_core.place_sell_order | compatibility | active | validator, readiness | Размещение ордера v1; новый код использует place_sell_order_v2. Обработчик активен — ждёт решения владельца. |
| aof_core.set_reroll_config | admin | active | readiness | Шансы реролла. |
| aof_core.refund_lottery_round | emergency | active | — | Восстановление: возврат билетов раунда, который не удалось разыграть (аудит F-23). |
| aof_core.migrate_config_v2 | migration | active | rust | Одноразовый перевод Config на раскладку v2 (роли operator/guardian). |
| aof_core.set_roles | admin | active | validator, readiness, rust | Назначение operator и guardian. |
| aof_core.emergency_stop | emergency | active | validator, readiness, rust | Guardian: пауза игры и/или заморозка выводов одним действием. |
| aof_core.set_cashout_frozen | emergency | active | validator, readiness, rust | Заморозка/разморозка выводов (operator/guardian). |
| aof_core.vrf_slot_recover | emergency | active | readiness | Оператор снимает блокировку слота VRF, чей держатель исчез. |
| aof_core.sync_tool_owner | gameplay | active | validator | Приводит кэш ToolData.owner/operator в соответствие с фактическим держателем supply-1 токена после обычного SPL-перевода; подписывает новый держатель, escrow-состояния (стейк/аренда/листинг/аукцион) не проходят proof. |
| aof_market.cancel_limit_order | candidate-dead-code | active | selfTests | Снимает лимитный ордер и возвращает эскроу; place_limit_order отключена, поэтому ордера не создаются. |
| aof_market.place_limit_order | candidate-dead-code | disabled-on-chain | — | Лимитные ордера отключены: нет инструкции матчинга и расчёта (TradingDisabled); аргументы сохранены ради IDL. |
| aof_quests.init_potato_bank | initialization | active | — | Изолированная казна Potato V2, изначально на паузе. |
| aof_quests.init_quest_config | initialization | active | — | QuestConfig: mint награды и казна; bringup эту инициализацию пока не выполняет. |
| aof_quests.potato_spin_commit | gameplay | disabled-on-chain | readiness | Отключена до подписанного devnet-прогона, VRF-смоков и независимого одобрения релиза. |
| aof_quests.potato_spin_expire | gameplay | active | — | Permissionless: возврат за спин Potato V2; достижим только после включения potato_spin_commit. |
| aof_quests.potato_spin_reveal | gameplay | active | — | Расчёт спина Potato V2 (работает и при паузе банка); достижим только после включения potato_spin_commit. |
| aof_quests.quest_init | admin | active | — | Оператор создаёт квест; клиента для этого пока нет (инструмент оператора). |
| aof_quests.set_potato_bank_paused | emergency | active | — | Пауза будущих коммитов Potato V2; расчёты и возвраты остаются доступны. |
| aof_session_keys.session_check_and_spend | gameplay | disabled-on-chain | selfTests, rust | Отключена (AtomicBindingRequired): резервирование не привязано к целевой инструкции в одной транзакции. |
| aof_session_keys.session_create | gameplay | disabled-on-chain | readiness | Отключена (AtomicBindingRequired): сессию нельзя выдавать, пока нет атомарной привязки к тратам. |
| aof_session_keys.session_pause | gameplay | active | selfTests | Пауза сессии владельцем (пользовательская защита). |
| aof_session_keys.session_revoke | gameplay | active | selfTests | Отзыв сессии владельцем (пользовательская защита). |

## Полный список

Колонки call sites: B — backend, S — admin-скрипты, F — frontend, G — game, P — platform (src/, functions/, watchtower/), C — CPI из других программ;
тесты: V — validator, T — самотесты, R — readiness, U — Rust; «bringup» — задействована ли в `devnet-bringup.sh`.

| Программа | Инструкция | Роль | Статус | B | S | F | G | P | C | V | T | R | U | bringup |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| aof_core | adjust_player_capacity | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |  |
| aof_core | auction_bid | gameplay | active | 2 | 0 | 0 | 0 | 1 | 0 | 1 | 1 | 0 | 0 |  |
| aof_core | auction_create | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | auction_settle | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | burn_nft | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |  |
| aof_core | burn_resource | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 0 |  |
| aof_core | burn_tool | gameplay | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 0 |  |
| aof_core | buy_lottery_ticket | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | ✓ |
| aof_core | cancel_buy_order | compatibility | active | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_core | cancel_sell_order | compatibility | active | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_core | claim_lottery_prize | gameplay | active | 1 | 0 | 2 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | ✓ |
| aof_core | claim_season_reward | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | collect_bread | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 2 | 0 |  |
| aof_core | collect_flour | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 2 | 1 |  |
| aof_core | collect_mining | gameplay | active | 1 | 1 | 0 | 0 | 0 | 0 | 2 | 1 | 3 | 0 | ✓ |
| aof_core | collect_well_water | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 1 |  |
| aof_core | collector_stake | gameplay | active | 1 | 0 | 3 | 0 | 0 | 0 | 1 | 1 | 1 | 0 |  |
| aof_core | collector_unstake | gameplay | active | 1 | 0 | 2 | 0 | 0 | 0 | 1 | 1 | 2 | 0 |  |
| aof_core | commit_lottery_draw | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 0 | ✓ |
| aof_core | craft | gameplay | active | 5 | 0 | 14 | 1 | 3 | 0 | 0 | 2 | 5 | 0 |  |
| aof_core | craft_order_cancel | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | craft_order_create | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | ✓ |
| aof_core | craft_order_fulfill | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | craft_recipe | gameplay | active | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |  |
| aof_core | deposit_gas | gameplay | active | 1 | 0 | 2 | 0 | 0 | 0 | 3 | 0 | 2 | 1 |  |
| aof_core | draw_lottery | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 3 | 0 |  |
| aof_core | explore_reveal | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 3 | 0 |  |
| aof_core | forge_attempt_commit | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 0 |  |
| aof_core | forge_attempt_reveal | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 3 | 0 |  |
| aof_core | forge_attempt_expire | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 0 |  |
| aof_core | grant_season_xp | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | harvest_wheat | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |  |
| aof_core | init_craft_economy | initialization | active | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| aof_core | init_lottery_round | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | init_material_mints | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | ✓ |
| aof_core | init_pack_config | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | init_rarity_counter | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| aof_core | init_reroll_config | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | init_season | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | initialize | initialization | active | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 0 | ✓ |
| aof_core | marketplace_buy | deprecated | disabled-on-chain | 0 | 0 | 2 | 0 | 0 | 0 | 1 | 2 | 1 | 0 |  |
| aof_core | marketplace_cancel | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 1 | 0 |  |
| aof_core | marketplace_list | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 1 | 0 |  |
| aof_core | match_resource_orders | compatibility | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |  |
| aof_core | migrate_tool | migration | disabled-on-chain | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | ✓ |
| aof_core | mint_resource | gameplay | active | 2 | 1 | 0 | 0 | 0 | 0 | 3 | 2 | 2 | 0 | ✓ |
| aof_core | mint_tool | gameplay | active | 2 | 0 | 0 | 0 | 2 | 0 | 5 | 1 | 3 | 1 | ✓ |
| aof_core | offer_accept | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | offer_cancel | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_core | offer_create | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | pack_open_commit | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 1 | 2 | 1 | ✓ |
| aof_core | pack_open_reveal | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | 4 | 1 |  |
| aof_core | pack_open_expire | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 2 | 2 | 1 |  |
| aof_core | pay_out | gameplay | active | 3 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 1 |  |
| aof_core | pay_out_with_referral | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |  |
| aof_core | place_buy_order | compatibility | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |  |
| aof_core | place_sell_order | compatibility | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |  |
| aof_core | plant_seeds | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | purchase_season_pass | gameplay | disabled-on-chain | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |  |
| aof_core | referral_bind | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | referral_upgrade | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | rental_end | gameplay | active | 1 | 0 | 0 | 0 | 1 | 0 | 2 | 0 | 0 | 1 |  |
| aof_core | rental_list | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |  |
| aof_core | rental_revoke | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |  |
| aof_core | rental_start | deprecated | disabled-on-chain | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 0 |  |
| aof_core | repair | gameplay | active | 1 | 0 | 5 | 0 | 2 | 0 | 2 | 0 | 0 | 0 |  |
| aof_core | start_mining_delegated | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | collect_mining_delegated | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | repair_delegated | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | reroll | gameplay | active | 2 | 1 | 1 | 0 | 2 | 0 | 1 | 4 | 5 | 1 | ✓ |
| aof_core | reroll_random_commit | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 2 | 0 | ✓ |
| aof_core | reroll_random_reveal | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 3 | 0 |  |
| aof_core | set_craft_economy | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | ✓ |
| aof_core | set_fees ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| aof_core | set_pack_config | admin | active | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | ✓ |
| aof_core | set_paused ~ | emergency | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | set_reroll_config | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_core | set_resource_mints | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | stake | gameplay | active | 1 | 0 | 3 | 0 | 1 | 0 | 2 | 1 | 1 | 0 |  |
| aof_core | start_baking | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | start_exploration_commit | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 0 |  |
| aof_core | start_milling | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | start_mining | gameplay | active | 1 | 1 | 0 | 0 | 1 | 0 | 2 | 0 | 1 | 0 | ✓ |
| aof_core | sweep_gas_fees | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 1 |  |
| aof_core | unstake | gameplay | active | 1 | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |  |
| aof_core | upgrade_exploration_tier | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_core | weather_crank | gameplay | active | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |  |
| aof_core | withdraw_gas | gameplay | active | 1 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 2 | 1 |  |
| aof_core | mint_resource_once | gameplay | active | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 2 | 0 |  |
| aof_core | marketplace_buy_bounded | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 1 | 0 | 0 |  |
| aof_core | init_issuance_cap | initialization | active | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | set_issuance_cap | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | set_pending_authority ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_core | accept_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | cancel_pending_authority ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| aof_core | set_mining_enabled | emergency | active | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 1 | 0 | ✓ |
| aof_core | init_vault_guard | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | ✓ |
| aof_core | set_vault_guard | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | ✓ |
| aof_core | set_supply_cap | admin | active | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 0 | ✓ |
| aof_core | register_collector_mint | admin | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | ✓ |
| aof_core | revoke_collector_mint | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | ✓ |
| aof_core | refund_lottery_round | emergency | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_core | migrate_config_v2 | migration | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |  |
| aof_core | set_roles | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |  |
| aof_core | emergency_stop | emergency | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |  |
| aof_core | set_cashout_frozen | emergency | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 |  |
| aof_core | rental_start_bounded | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |  |
| aof_core | rental_delist | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | auction_cancel | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_core | vrf_pool_add ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | vrf_pool_set_retired ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_core | vrf_slot_recover | emergency | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_core | reroll_random_expire | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 0 |  |
| aof_core | explore_expire | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 0 |  |
| aof_core | expire_lottery_draw | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 0 |  |
| aof_core | refund_lottery_ticket | gameplay | active | 1 | 0 | 2 | 0 | 0 | 0 | 1 | 1 | 1 | 1 | ✓ |
| aof_core | place_buy_order_v2 | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | place_sell_order_v2 | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | cancel_buy_order_v2 | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | cancel_sell_order_v2 | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | match_resource_orders_v2 | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_core | reset_for_rebirth | gameplay | active | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 1 | 2 | 0 |  |
| aof_core | transfer_tool | gameplay | active | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 0 | 0 |  |
| aof_core | sync_tool_owner | gameplay | active | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_market | cancel_limit_order | candidate-dead-code | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| aof_market | crank_market | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| aof_market | hot_market_buy | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 0 | ✓ |
| aof_market | hot_market_sell_into_queue | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | ✓ |
| aof_market | hot_market_skip | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | ✓ |
| aof_market | init_market_config | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_market | init_pool | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ✓ |
| aof_market | place_limit_order | candidate-dead-code | disabled-on-chain | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_market | set_fees ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_market | set_paused ~ | emergency | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_market | start_market_event | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ✓ |
| aof_market | set_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_market | accept_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_market | cancel_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | accept_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | achievement_unlock | gameplay | disabled-on-chain | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | cancel_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | challenge_contribute | gameplay | disabled-on-chain | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | challenge_init | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | drum_commit | gameplay | disabled-on-chain | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 3 | 0 |  |
| aof_quests | drum_expire | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 0 |  |
| aof_quests | drum_reveal | gameplay | active | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 3 | 0 |  |
| aof_quests | init_potato_bank | initialization | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | init_quest_config | initialization | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | potato_spin_commit | gameplay | disabled-on-chain | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_quests | potato_spin_expire | gameplay | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | potato_spin_reveal | gameplay | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | quest_claim_reward | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_quests | quest_init | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | set_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | set_potato_bank_paused | emergency | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | vrf_pool_add ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_quests | vrf_pool_set_retired ~ | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_rebirth | do_rebirth | gameplay | active | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | 3 | 0 |  |
| aof_rebirth | init_rebirth_config | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |  |
| aof_rebirth | set_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_rebirth | accept_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_rebirth | cancel_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_liquidity | init_lp_config | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_liquidity | lp_deposit | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |  |
| aof_liquidity | lp_withdraw | gameplay | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_liquidity | set_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_liquidity | accept_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_liquidity | cancel_pending_authority ~ | admin | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| aof_session_keys | init_config | initialization | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 3 | 0 | ✓ |
| aof_session_keys | session_check_and_spend | gameplay | disabled-on-chain | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 |  |
| aof_session_keys | session_create | gameplay | disabled-on-chain | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |  |
| aof_session_keys | session_pause | gameplay | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| aof_session_keys | session_revoke | gameplay | active | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |  |
| aof_session_keys | trust_snapshot_update | admin | active | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  |
