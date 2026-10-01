# Модель владения инструментом: token-primary ownership

Дата: 2026-10-01. Сессия `arena/01a0f648-aof`.

## Решение владельца

Игровой инструмент — обычный classic SPL-токен (`decimals = 0`, `supply = 1`,
`freeze_authority = None`). Любой держатель может перевести его обычным
`spl_token::transfer`, не обращаясь к программе. Программа такие переводы не
видит и **не может** их запретить: freeze authority отсутствует намеренно, её
требуют восемь проверок `mint.freeze_authority.is_none()` (`mint_tool`, `craft`,
`reroll`, `marketplace_list`, `auction_create`, `offer_create`,
`offer_accept`, `rental_list`).

Поэтому:

* **авторитетное доказательство владения — сам supply-1 токен**, а не запись в
  `ToolData`;
* `ToolData.owner` и `ToolData.operator` — **кэш**, который может отставать от
  фактического держателя токена после обычного SPL-перевода;
* `transfer_tool` (`aof_core`) остаётся предпочтительным путём: одна инструкция
  атомарно двигает токен, кэш, обязательства и эмитит событие;
* после обычного SPL-перевода новый держатель вызывает `sync_tool_owner` и
  восстанавливает согласованность.

Не вводится: freeze authority, Token-2022, Bubblegum, MPL Core, off-chain
ownership. Программные адреса и keypair'ы сохраняются.

## Матрица состояний

`token location` — где физически лежит supply-1 токен в момент вызова.

| Mechanic | Token location | `ToolData.owner` | `operator` | Lock / escrow account | Raw transfer возможен | Авторизация после правки |
|---|---|---|---|---|---|---|
| `transfer_tool` | ATA отправителя | = sender (проверяется) | = sender (проверяется) | нет | да | ✅ token: `owner == sender`, `amount >= 1` |
| `burn_tool` | ATA владельца | = user | = user | нет | да | ✅ token: `owner == user`, `amount == 1` |
| `burn_nft` | ATA владельца | = user | = user | нет | да | ✅ token: `owner == user`, `amount == 1` |
| `craft` | ATA владельца (prev) | = user | = user | нет | да | ✅ token: `owner == user`, `amount == 1` |
| `reroll` | ATA владельца (prev) | = user | = user | нет | да | ✅ token: `owner == user`, `amount == 1` |
| `stake` | ATA → `vault` (эскроу) | = user | = user | `vault` PDA | после стейка нет | ✅ token: `owner == user`, `amount == 1` |
| `unstake` | `vault` → ATA | = user | = user | `vault` PDA | во время стейка нет | ✅ token: `owner == user` |
| `start_mining` | `vault` (застейкан) | = user | = user | `vault` PDA | во время стейка нет | ✅ **добавлено**: эскроу-проверка `vault_token` |
| `collect_mining` | `vault` (застейкан) | = user | = user | `vault` PDA | во время стейка нет | ✅ **добавлено**: эскроу-проверка `vault_token` |
| `repair` | ATA владельца **или** `vault` | = user (в обработчике) | = user | нет / `vault` | да (idle) | ✅ **добавлено**: `tool_token` + два допустимых места |
| `marketplace_list` | ATA → `listing_vault` | = seller | = seller | `listing` PDA | после листинга нет | ✅ token: `owner == seller`, `amount == 1` |
| `marketplace_buy` | `listing_vault` | `operator == owner` | — | `listing` PDA | нет | ✅ эскроу листинга |
| `marketplace_cancel` | `listing_vault` → ATA | `listing.seller` | — | `listing` PDA | нет | ✅ `listing.seller == seller` |
| `auction_create` | ATA → `auction_vault` | = seller | = seller | `auction` PDA | после создания нет | ✅ token: `owner == seller`, `amount == 1` |
| `auction_settle` | `auction_vault` | `operator == owner` | — | `auction` PDA | нет | ✅ эскроу аукциона + канонический ATA победителя |
| `offer_accept` | ATA продавца | = seller | = seller | нет | да | ⚠️ token: `owner == seller`, **но `amount` не проверяется** |
| `rental_list` | ATA → `rental_vault` | = owner | = owner | `rental_listing` PDA | после листинга нет | ✅ token: `owner == owner`, `amount == 1` |
| `rental_start` | `rental_vault` | = `rental_listing.owner` | → renter | `rental_listing` PDA | нет | ✅ эскроу + `vault.amount == 1` |
| `rental_end` / `rental_revoke` | `rental_vault` | — | = `agreement.renter` | `rental_listing` PDA | нет | ✅ запись аренды как proof делегирования |
| `rental_delist` | `rental_vault` → ATA | `operator == owner` | — | `rental_listing` PDA | нет | ✅ запись листинга |
| `start_mining_delegated` | `rental_vault` | = `agreement.owner` | = renter | `rental_listing` PDA | нет | ✅ **новое**: активная аренда + эскроу листинга + сессия внутри срока |
| `collect_mining_delegated` | `rental_vault` | = `agreement.owner` | = renter | `rental_listing` PDA | нет | ✅ **новое**: та же запись (без требования «ещё не истекла» — сессия короче аренды) |
| `repair_delegated` | `rental_vault` | = `agreement.owner` | = renter | `rental_listing` PDA | нет | ✅ **новое**: активная аренда + эскроу; ресурсы жжёт арендатор |

### Что это означает

1. **Большинство механик уже были защищены эскроу**, а не кэшем: `stake`,
   `marketplace_*`, `auction_*`, `rental_*`, `craft`, `reroll`, `burn_*`,
   `transfer_tool` требуют реальный `amount == 1` на аккаунте подписанта, а на
   время операции держат токен в program-controlled vault. Обычный SPL-перевод
   там невозможен: токен принадлежит не игроку, а PDA программы.
2. **Дыра была в трёх инструкциях** (`start_mining`, `collect_mining`, `repair`):
   они авторизовались по кэшу — `ToolData.operator` плюс доверие флагу
   `staked` — и вообще не загружали токен. Правка добавляет проверку самого
   токена (см. ниже).
3. **`operator != owner` (аренда) никогда не проверяется через
   `token.owner == operator`**: арендатор — оператор, но токеном не владеет.
   Право доказывается записью аренды (`RentalAgreement.renter`, `agreement.end`)
   плюс тем, что токен лежит в `rental_vault` листинга.

## Что именно изменено

### Общий helper

`aof-core/src/instructions/tool_ownership.rs` — единственное место, где живёт
проверка владения, чтобы механики не расходились в её реализации:

* `assert_idle_tool_ownership(tool, mint, token, holder)` — `token.mint ==
  tool.mint`, `token.owner == holder`, `token.amount == 1`, а также каноническая
  форма mint (`decimals == 0`, `supply == 1`, `freeze_authority == None`) и
  свобода инструмента (`!staked`, `!is_mining`). Кэш `tool.owner` намеренно не
  сверяется: это путь восстановления после обычного перевода;
* `assert_token_in_escrow(tool, mint, token, escrow)` — токен лежит в
  program-controlled vault (стейк или vault записи). Это proof делегированного
  состояния: `token_account.owner == operator` здесь было бы неверно;
* `assert_canonical_tool_mint` — форма mint, которая проверяется при каждом
  доказательстве, а не только при минте: mint приходит аккаунтом, и без проверки
  чужой 0-decimal минт выдал бы себя за инструмент.

### `sync_tool_owner` (новая инструкция)

Восстанавливает кэш после обычного SPL-перевода.

* подписывает **новый держатель** — permissionless-keeper не должен уметь сбросить
  `operator` или тронуть runtime-состояние;
* требует `holder_token.owner == holder` и `amount == 1` (плюс форму mint в helper);
* обновляет `owner` и `operator`, сбрасывает `unlock_at` (как `transfer_tool`),
  эмитит `ToolOwnershipSynced` с предыдущими значениями кэша;
* **не** трогает `rarity`, `durability`, `mining_end`, `last_mined_hours`,
  `tool_type`;
* **не может обойти активные обязательства**: при стейке, аренде, листинге или
  аукционе токен лежит в escrow-аккаунте программы, а не на личном ATA
  держателя, поэтому `amount == 1` на его аккаунте не выполняется и proof не
  проходит. Отдельного вето на «активную аренду» не требуется — эскроу уже
  исключает случай;
* `config` в контексте нет намеренно: синхронизация не двигает ценность и
  относится к exit-путям (как `unstake`/`marketplace_cancel`), которые пауза не
  должна блокировать.

### Ужесточение `repair`

Было: проверка только `ToolData.owner == user` (в обработчике) и
`ToolData.operator == user` (в контексте) — токен не проверялся вообще, поэтому
владелец, уже переведший инструмент обычным SPL-переводом, мог продолжать его
чинить.

Стало: `tool_token` в контексте плюс `assert_repair_authority` — допускаются ровно
два места, где может лежать инструмент:

1. личный ATA подписанта → `assert_idle_tool_ownership`;
2. общий program `vault` → `assert_token_in_escrow` (застейканный инструмент).

Адрес vault **выводится** (`[VAULT_SEED]`), а не принимается аккаунтом: иначе
подписант подсунул бы свой токен-аккаунт и выдал его за эскроу.

### Ужесточение `start_mining` / `collect_mining`

Было: `ToolData.operator == user` и доверие флагу `ToolData.staked`.

Стало: добавлены `vault` и `vault_token`, и `assert_token_in_escrow` проверяет,
что токен действительно лежит в эскроу программы. Инвариант «`staked == true`
означает, что токен в vault» теперь **проверяется**, а не предполагается.

## Делегированные действия арендатора

До этой правки `operator` не давал арендатору **ничего**: `start_mining` и
`collect_mining` требуют `staked == true` (это было уже до токен-праймари
изменений), `rental_list` требует `!staked`, а `repair` в обработчике требовал
`owner == user`. То есть механика аренды была достижима только как эскроу-залог,
без полезных действий.

Что добавлено (три инструкции, а не «пустые» аккаунты в существующих, чтобы
стейк-путь не менялся):

* `start_mining_delegated(hours)` — сессия арендатора; на время сессии жители
  списываются из профиля арендатора;
* `collect_mining_delegated()` — награда уходит на ATA арендатора, durability
  списывается с инструмента;
* `repair_delegated(amount)` — арендатор чинит **своими** ресурсами.

Единый proof — `tool_ownership::check_rental_delegation` (одна реализация, две
обёртки: `assert_active_rental_delegation` для старта сессии и
`assert_rental_collect_right` для сбора): `RentalAgreement.mint == RentalListing.mint == ToolData.mint`,
`agreement.renter == подписант == tool.operator`, владелец в `ToolData` и в
записях совпадает, листинг активен, инструмент не в стейке, и — для старта —
`now < agreement.end`. Токен обязан лежать в `rental_vault` листинга
(`assert_token_in_escrow`): `token_account.owner == operator` для аренды
**неверно**, арендатор токеном не владеет.

### Порядок проверок (важно для ожиданий в тестах)

Гейт `operator` продублирован в констрейнтах контекста
(`constraint = tool.operator == user.key() @ NotToolOperator`) и срабатывает
**до** обработчика. Поэтому в делегированных инструкциях владелец и посторонний
получают `NotToolOperator` независимо от состояния сессии, листинга и vault.

Внутри обработчика авторизация идёт раньше бизнес-проверок: `mining_enabled` →
proof аренды → эскроу → (`hours`/`durability` для старта; `now >= mining_end`
для сбора). Так отказ по правам не зависит от значений `hours` или от того,
завершилась ли сессия; арендатор на незавершённой сессии получает
`MiningNotComplete`, а не отказ авторизации.

### Семантика награды (закрывает открытый вопрос о pending rewards)

Программа не видит момента обычного SPL-перевода и не может его датировать.
Для аренды принята явная семантика, зафиксированная кодом:

1. `start_mining_delegated` требует, чтобы сессия завершилась **до конца
   аренды**: `now + hours * 3600 <= agreement.end` (`RentalSessionTooLong`).
2. Поэтому между `mining_end` и `agreement.end` есть гарантированное окно, когда
   аренду не может завершить никто, кроме самого арендатора: `rental_end`
   разрешает чужой вызов только после `agreement.end`.
3. Сбор награды доступен **только арендатору** (`renter == operator`), в том
   числе после `agreement.end`, пока аренда не закрыта. Владелец чужую сессию
   забрать не может: он не оператор, пока аренда активна.
4. `rental_end` и `rental_revoke` гасят незавершённую сессию
   (`is_mining = false`, `mining_end = 0`, `last_mined_hours = 0`). Иначе флаг
   остался бы висеть и навсегда заблокировал владельцу `start_mining` после
   делиста. **Награда при гашении не минтится никогда.** Для незавершённой
   сессии это корректно: durability не списана, зарабатывать было нечего. Для
   завершённой, но несобранной сессии это осознанная гонка: на интервале
   `[mining_end, agreement.end)` аренду не может закрыть никто, кроме самого
   арендатора, — окно для сбора гарантировано; после `agreement.end` владелец
   вправе закрыть аренду первым, и невыбранная награда сгорает. Альтернативы
   отвергнуты сознательно: поле «начислено» в `ToolData` потребовало бы
   миграции, а сохранение флага сессии навсегда оставляло бы инструмент
   заблокированным брошенной (или мстительной) сессией арендатора.

## Явная семантика для незакрытого вопроса

Программа **не видит** момента обычного SPL-перевода и не может его датировать.
Это не мешает безопасности — после правки прежний держатель теряет все права
сразу, потому что у него больше нет токена, — но требует явной семантики для
уже накопленного состояния:

* **майнинг**: награда начисляется только в `collect_mining`, а он требует
  эскроу-проверку. Инструмент в эскроу перевести обычным переводом нельзя,
  поэтому «начал майнить, потом перевёл токен» невозможно. Если инструмент
  выведен из стейка (`unstake`), `is_mining` уже `false`, а `unstake` требует
  `!is_mining`;
* **незавершённый майнинг при обычном переводе невозможен** по предыдущему
  пункту: idle-инструмент не майнит;
* **durability и rarity** следуют за токеном: они часть `ToolData`, а `ToolData`
  привязан к mint через PDA `[TOOL_SEED, mint]`.

## Validator-покрытие (написано, но НЕ выполнено)

Файл `tests/aof_tool_ownership.ts` (подключён в `Anchor.toml` сразу после
`tests/aof_core.ts`, чей `before()` создаёт `Config`, `MaterialMints` и mint'ы
ресурсов). 21 сценарий (сценарии 20–21 помечены `it.skip`: локальный валидатор
не умеет двигать время, поэтому `RentalSessionTooLong` и выплата за
завершённую сессию проверяются только на машине с управляемым временем):

| # | Сценарий | Где в тесте | Статус |
|---|---|---|---|
| 1 | `transfer_tool` двигает токен и кэш одной транзакцией | «transfer_tool двигает токен и кэш…» | pending |
| 2 | обычный SPL-перевод не создаёт второго владельца: кэш отстаёт, прежний держатель теряет `transfer_tool` | «raw SPL transfer рассинхронизирует кэш…» | pending |
| 3 | без `sync` новый держатель не может `burn_nft` (`NotToolOwner`) | там же | pending |
| 4 | `sync_tool_owner` восстанавливает кэш и права | «sync_tool_owner восстанавливает кэш…» | pending |
| 5 | посторонний (без токена) не может вызвать `sync_tool_owner` | «посторонний не может вызвать sync_tool_owner» | pending |
| 6 | `sync` с чужим mint отклонён | «sync отклоняет чужой mint…» | pending |
| 7 | `sync` при нулевом балансе отклонён | там же | pending |
| 8 | `sync` с чужим token account отклонён | там же | pending |
| 9 | свободный инструмент не запускает майнинг (нет токена в эскроу) | «майнинг требует токен в эскроу…» | pending |
| 10 | застейканный (токен в vault) — майнинг стартует | там же | pending |
| 11 | эскроу нельзя вывести обычным SPL-переводом | там же | pending |
| 12 | `repair` после перевода: прежний владелец получает `ZeroAmount` (idle-проверка `amount == 1`) | «repair после raw transfer…» | pending |
| 13 | `repair` без `sync`: новый держатель получает `NotToolOperator` (констрейнт `tool.operator`) | там же | pending |
| 14 | `collect_mining` принимает только vault-токен (`NotToolOwner`) | «collect_mining требует token account эскроу…» | pending |
| 15 | `stake` после перевода: без `sync` — `NotToolOwner` (констрейнт `tool.owner` раньше `operator`), после `sync` — успех | «stake после raw transfer…» | pending |
| 16 | делегированный майнинг: арендатор может, владелец и посторонний получают `NotToolOperator`; `mining_end <= agreement.end`; повторный старт — `AlreadyMining` | «делегированный майнинг…» | pending |
| 17 | делегированный сбор: посторонний — `NotToolOperator` раньше любых проверок состояния, арендатор на незавершённой сессии — `MiningNotComplete`, токена у арендатора нет | «делегированный сбор…» | pending |
| 18 | `rental_end` арендатором гасит брошенную сессию и возвращает `operator` владельцу | «rental_end арендатором гасит…» | pending |
| 19 | `repair_delegated`: proof арендатора пройден (упирается в `DurabilityOverflow` свежего инструмента), владелец — `NotToolOperator`, обычный `repair` арендатору — `NotToolOwner` | «repair_delegated авторизует…» | pending |
| 20 | `RentalSessionTooLong` (сессия длиннее остатка аренды) | `it.skip` — нужен сдвиг времени валидатора | **заблокировано локально** |
| 21 | завершённая делегированная сессия платит арендатору | `it.skip` — нужен сдвиг времени валидатора | **заблокировано локально** |

⚠️ **Это не доказательство.** В песочнице агента нет
`cargo`/`anchor`/`solana-test-validator`, поэтому `anchor build` не выполнялся и
ни один из 21 сценария **не запускался**. Корректная формулировка статуса:
«validator regression test написан, execution pending». Проверено только то, что
проверяемо статически: типы (`tsc --noEmit`) и соответствие имён аккаунтов IDL.
Не покрыто этими сценариями: положительный путь `repair` для застейканного
инструмента (нужен ресурсный баланс и снятая durability) и `collect_mining` на
завершённой сессии (нужен сдвиг времени валидатора).

## Открытый остаток

* `offer_accept` проверяет `seller_token.owner == seller`, но **не** проверяет
  `amount == 1`. Это не создаёт рассинхронизации (SPL-перевод сам упадёт при
  нулевом балансе), но проверку стоит добавить отдельным изменением для
  единообразия.
* Rust-код **не собран**, validator-тесты **не запускались**: в песочнице агента
  нет `cargo`/`anchor`/`solana-test-validator`. См. чеклист в Draft PR #32.
