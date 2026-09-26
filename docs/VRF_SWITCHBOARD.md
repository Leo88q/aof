# Случайность: Switchboard On-Demand (production)

Статус: **включено** для паков, случайного reroll, экспедиций, кузницы, лотереи (`aof-core`) и барабана удачи (`aof-quests`). Закрывает F-06 и пункты чек-листа #36/#37.

## 1. Почему именно так

У Switchboard On-Demand коммитить и раскрывать аккаунт случайности может **только его `authority`**. От выбора владельца зависит, у кого появляется «бесплатный опцион»:

| Владелец аккаунта | Кто может увидеть значение и не раскрыть его | Итог |
|---|---|---|
| Игрок | игрок: плохой бросок не раскрывает и ждёт возврата | опцион у игрока |
| Бэкенд (operator) | дом: джекпот не раскрывает | опцион у дома |
| **PDA самой программы** | никто: раскрыть может любой, помешать — никто | **выбрано** |

Итоговая схема:

1. **Commit** — в одной инструкции игра:
   - принимает оплату в escrow на PDA коммита;
   - снимает снимок всех параметров исхода (шансы пака/reroll, тир экспедиции, уровень кузницы);
   - через CPI делает `randomness_commit` на свободном слоте пула, подписывая PDA `vrf_authority`;
   - блокирует слот за этим коммитом.

   Между выбором seed и блокировкой ставки нет окна.
2. **Reveal** — permissionless. Значение оракула может принести кто угодно: сервис `vrf-settler`, сам игрок или третья сторона. Программа:
   - через CPI делает `randomness_reveal` (подпись PDA);
   - читает проверенное значение обратно из аккаунта;
   - в той же инструкции рассчитывает исход.

   Скрыть результат нечем.
3. **Refund** — только начиная с `commit_slot + VRF_REFUND_AFTER_SLOTS` (18 000 слотов, ≈2 ч). Раскрытие закрывается на этом же слоте, поэтому «раскрыть, если хорошо, вернуть, если плохо» невозможно: два пути никогда не открыты одновременно.

Остаточный риск: сервис раскрытия не работает дольше окна оракула (≈1 ч), и игрок, посмотрев значение у gateway, выбирает возврат. Этот риск закрывают:

- **Operator co-sign на всех платных коммитах `aof-core`.** Если сервис лежит целиком, новых коммитов нет.
- **Circuit breaker.** Коммиты перестают подписываться, если любой слот пула занят дольше `VRF_MAX_PENDING_SLOTS` (по умолчанию 450 ≈ 3 мин). Ответ — `503 VRF_SETTLEMENT_DEGRADED`.
- **Резерв и мониторинг.** Резервный `vrf-settler` на другом хосте с `VRF_SETTLER_STANDBY_SLOTS=120`, своим кошельком и своим RPC. Пока основной раскрывает коммиты за секунды, резервный простаивает. Он берёт коммиты старше ~50 с, то есть подхватывает работу, когда основной лежит. Плюс алерт Watchtower на `VrfCommitted` без `VrfSettled`.
- **Барабан (без operator).** При инциденте guardian ставит `paused` для квестов.

Независимая проверка поведения Switchboard на devnet (замеры [pina-rs/lootbox](https://github.com/pina-rs/lootbox/blob/main/docs/randomness-lanes.md), 2026-09-26) совпадает с допущениями этой схемы:

- Switchboard **принимает новый коммит поверх нераскрытого** и молча подменяет seed и оракула. Второе открытие не может перезаписать первое только благодаря блокировке `VrfSlot`: слот занят до раскрытия или возврата.
- Reveal **обнуляет** поле `oracle`. Поэтому оракул сверяется до CPI, а после CPI — `seed_slot`, `reveal_slot` и значение.
- Аккаунт можно коммитить повторно. Коммиты в одном слоте дают разные значения, так как значение привязано к адресу аккаунта.
- Gateway отдаёт доказательство через 0,1–0,5 с после коммита, самый быстрый цикл — 6 слотов (2,2 с). Плата оракулу не взимается.
- Годных оракулов в очереди 5 из 9 на devnet и 6 из 12 на mainnet. Без фильтрации по свежести часть коммитов попадала бы к мёртвым оракулам.

## 2. On-chain

| Что | Где |
|---|---|
| CPI, проверки аккаунта, окна, выведение исхода | `aof-core/src/vrf.rs`; копия `programs/aof-quests/src/vrf.rs` генерируется `scripts/sync-quests-vrf.py` |
| Пул: `vrf_pool_add`, `vrf_pool_set_retired`, `vrf_slot_recover` | `aof-core/src/instructions/vrf_pool.rs` (operator) |
| Пул барабана: `vrf_pool_add`, `vrf_pool_set_retired` | `programs/aof-quests/src/instructions/drum/vrf_pool.rs` (authority квестов) |
| NFT расчёта (паки, reroll) | PDA-mint `[pack_mint / reroll_mint, commit]`, создаётся при раскрытии; занять или заранее выпустить его нельзя |
| Выдача и возврат лотереи | полная цена билета хранится в раунде; розыгрыш отправляет 30% в казну; неразыгранный раунд возвращает каждый билет (`refund_lottery_ticket`) |

### Интерфейс Switchboard

Он зафиксирован в `docs/vendor/switchboard_on_demand_randomness.json`: срез опубликованного IDL, совпадающий в четырёх независимых копиях. `tests/readiness/vrf.test.cjs` сверяет с ним:

- порядок аккаунтов;
- флаги signer/writable;
- дискриминаторы;
- смещения полей.

Доверенные адреса:

| | mainnet | devnet (`--features devnet`) |
|---|---|---|
| Программа | `SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv` | `Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2` |
| Очередь | `A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w` | `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` |
| State PDA | `7Gs9n5FQMeC9XcEhg281bRZ6VHRrCvqp5Yq1j78HkvNa` | `4UFmCebEmzESoDTtHrmaftXj7YAsAH4HMios3yMWyVUT` |

### Проверки в каждом контексте

- **Идентификация:**
  - программа Switchboard — `Program<'info, SwitchboardOnDemand>` (ключ + executable);
  - очередь — только доверенная;
  - `vrf_slot` — канонический PDA слота;
  - `randomness` — адрес из слота или коммита.
- **Reveal:**
  - оракул равен назначенному при коммите;
  - `stats` — PDA оракула;
  - `reward_escrow` — ATA аккаунта случайности;
  - `program_state` — State PDA.
- **Внутри `vrf::commit`:**
  - слот свободен и не выведен;
  - authority аккаунта — наш PDA, очередь доверенная;
  - после CPI `seed_slot == slot − 1`.
- **Внутри `vrf::reveal`:**
  - держатель слота — именно этот коммит, окно открыто;
  - после CPI: `seed_slot` совпадает, `reveal_slot == slot`, значение равно подписанному.

## 3. Бэкенд

| Компонент | Роль |
|---|---|
| `src/lib/vrf.ts` | Пул и circuit breaker; выбор оракула и запрос reveal у gateway оракула (см. «Оракулы и gateway») |
| `src/lib/vrfSettlement.ts` | Построение commit/reveal/refund для всех шести механик. Используют и маршруты, и воркер |
| `services/vrf-settler` | Раскрывает все ожидающие коммиты за секунды, после окна возвращает средства. Идемпотентен, можно запускать несколько реплик. Параллельно до `VRF_SETTLER_CONCURRENCY` (8) коммитов. При сбоях оракула — экспоненциальная пауза до 60 с. Подписывает отдельным кошельком только для комиссий (`VRF_SETTLER_SECRET_KEY_FILE`, `lib/settlerSigner.ts`), без ключа operator: раскрытие и возврат permissionless. Production без такого кошелька не стартует. Предупреждение `low_balance`, если на этом кошельке меньше 0,5 SOL. Режим резерва: `VRF_SETTLER_STANDBY_SLOTS`. Watchdog перезапускает зависший процесс, healthcheck контейнера читает heartbeat-файл |
| Маршруты | `POST /packs/commit`, `/reroll/random/commit`, `/exploration/start/commit`, `/forge/commit`, `/drum/commit` возвращают транзакцию, подписанную operator, для подписи игроком. `…/reveal` возвращает транзакцию, где раскрывает сам игрок. `GET …/status/:commit`. Лотерея: `/lottery/draw/commit` (admin), `/lottery/ticket/buy`, `/lottery/ticket/refund` |
| `/vrf` | `GET /vrf/health`, `GET /vrf/pending?user=`, `POST /vrf/pool/add`, `POST /vrf/pool/retire` (admin) |

Переменные окружения описаны в `aof_backend/.env.example` (раздел F-06). **`SWITCHBOARD_CLUSTER` обязан совпадать со сборкой программы.**

### Оракулы и gateway

- **Выбор оракула для коммита.** Список берётся из `Queue.inspectRandomnessOracles()` SDK: он проверяет on-chain свежесть оракула (heartbeat, срок quote, верификация enclave, членство в очереди) и живое здоровье через Crossbar. Бэкенд оставляет только годные оракулы, предпочитает живые и выбирает среди них **случайно**.
  - Штатный селектор SDK всегда отдаёт одного «лучшего» оракула. Случайный выбор разносит коммиты по разным оракулам: `randomness_commit` пишет в аккаунт оракула, и все пользователи Switchboard делят бюджет записи одних и тех же аккаунтов. Кроме того, отказ одного оракула задевает только его долю коммитов.
  - Список кэшируется на 30 с. Если обновить его не удалось, до 5 мин используется последний удачный список, дальше коммиты получают `503 VRF_ORACLE_UNAVAILABLE`. Деньги при этом не списываются.
- **Reveal.** Бэкенд сам отправляет `POST {gateway}/gateway/api/v1/randomness_reveal` с полями `slothash`, `randomness_key`, `slot` оракулу, которого Switchboard закрепил при коммите.
  - `Randomness.revealIx()` из SDK не используется: он передаёт стороннему gateway URL нашего RPC (обычно с платным API-ключом) и перед запросом всегда ждёт 3 с. Защита от возврата к нему — `tests/readiness/vrf.test.cjs`.
  - Поле `rpc` отправляется, только если задан `SWITCHBOARD_GATEWAY_RPC_URL`. Это аварийная настройка, в неё можно вписать только публичный URL без ключа.
  - Ответу gateway не доверяем: подпись enclave проверяет сам Switchboard в `randomness_reveal`, а программа читает значение обратно из аккаунта. Плохой gateway может только сорвать попытку, а settler её повторит.

Транзакции раскрытия и возврата:

- несут лимит 400k CU (`VRF_COMPUTE_UNITS`) и приоритетную комиссию 5000 µlamports/CU (`VRF_PRIORITY_MICROLAMPORTS`) — около 0,000002 SOL. Комиссия ограничена потолком wallet guard, иначе кошелёк игрока отклонил бы самостоятельное раскрытие;
- помещаются в legacy-транзакцию с запасом. Это проверяет `tests/readiness/vrf-tx-size.test.cjs`: самая большая, `explore_reveal`, занимает ~1,09 КБ из 1,23 КБ.

Если симуляция падает с превышением CU, поднимите `VRF_COMPUTE_UNITS`. Для RPC нужен собственный (платный) узел: воркер опрашивает `getProgramAccounts` раз в 3 с.

## 4. Фронтенд

- **`PacksPage`.** Открытие в одну подпись. Затем опрос статуса. Через 25 с появляется кнопка «Раскрыть самостоятельно», после окна раскрытия она же делает возврат. Показан список незавершённых открытий.
- **`DrumSpin`.** Та же схема. Приз читается из события `DrumRevealed` (`GET /drum/status/:user`). Таблица шансов на экране (`frontend/src/lib/drumTable.ts`) сверяется в CI с `DRUM_PRIZES` программы.
- **Экспедиции и лотерея.** Ожидание раскрытия и самостоятельное раскрытие.
- **Ошибки.** Коды (`VRF_POOL_EXHAUSTED`, `VRF_SETTLEMENT_DEGRADED`, …) показываются игроку понятным текстом (`frontend/src/lib/vrfErrors.ts`).
- **Wallet guard.**
  - `PackOpenIntent`: ровно один `pack_open_commit` этого кошелька, выбранного типа и с принятым потолком цены; вторая подпись — operator.
  - Switchboard допускается только как CPI игровой программы: прямая инструкция Switchboard отклоняется.

## 5. Запуск (runbook)

Порядок для devnet, затем mainnet:

1. **Сборка.**
   - devnet: `anchor build -- --features devnet`;
   - mainnet: без флага.

   Бэкенд: `SWITCHBOARD_CLUSTER=devnet|mainnet`.
2. **Деплой программ** и шаги 1–3 `docs/SECURITY_RUNBOOK.md`. Роль operator должна быть у ключа бэкенда.
3. **Пул:**

   ```bash
   for i in 1 2; do   # не больше 16 слотов за запрос
     curl -X POST $API/vrf/pool/add -H "Authorization: Bearer $ADMIN_TOKEN" \
       -H 'Content-Type: application/json' -d '{"program":"core","count":16}'
   done
   curl -X POST $API/vrf/pool/add -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H 'Content-Type: application/json' -d '{"program":"quests","count":4}'
   curl $API/vrf/health     # core.free == 32, quests.free == 4, healthy: true
   ```

   Стоимость слота ≈ 0,009 SOL (`docs/ECONOMY_RNG_EV.md`). Слот занят от коммита до раскрытия. Это опрос settler (до 3 с) + 2 слота + ответ gateway (0,1–0,5 с) + подтверждение транзакции, обычно 2–5 с. Нужно слотов = пиковая частота открытий × 5 с, значит 32 слота core хватает на 6–16 открытий в секунду. Пул можно расширять на ходу, без остановки игры. Если бэкенд запущен в нескольких репликах, каждой задать `VRF_POOL_SHARD=i/n` (`0/2`, `1/2`, …). Тогда реплики берут непересекающиеся слоты и не отдают один слот двум игрокам сразу (иначе подписанный коммит одного из них падает с `VrfSlotBusy`).
4. **`vrf-settler`.** Запускается по умолчанию в `docker-compose.prod.yml`. Подписывает отдельным кошельком: `solana-keygen new -o secrets/vrf_settler_secret_key`, override `docker-compose.secrets.yml`. Ключ operator воркеру не нужен и не передаётся, он работает в `AUTHORITY_MODE=read-only` (в `.env` нужен `AUTHORITY_PUBKEY`). На кошельке settler держать ≥ 1 SOL на комиссии раскрытий и временную ренту: она возмещается из депозита игрока. Для отказоустойчивости поднять резервный экземпляр на другом хосте: свой кошелёк, свой RPC, `VRF_SETTLER_STANDBY_SLOTS=120`.
5. **Конфиги механик** (admin multisig, если не заданы):
   - `init_pack_config` ×3, `init_reroll_config`;
   - `init_lottery_round`;
   - `init_quest_config` с пополненной казной маскотов: не меньше 50 на каждый одновременный спин.
6. **Смоук-тест на devnet** — `node scripts/vrf/devnet-smoke.mjs` (см. раздел 7).
7. **Мониторинг:**
   - `/vrf/health`: алерт, если `healthy=false`;
   - Watchtower: `LiabilityCreated{liability:"vrf_commit"}` без `LiabilitySettled` дольше 5 мин;
   - логи `vrf-settler`: серия `attempt_failed`, любое `low_balance`, `watchdog_exit`, `cycle_failed`;
   - логи бэкенда: `[vrf] oracle refresh failed` и ответы `503 VRF_ORACLE_UNAVAILABLE`;
   - статус контейнера `vrf-settler`: `unhealthy`.

## 6. Инциденты

| Ситуация | Признак | Действие |
|---|---|---|
| `vrf-settler` упал | `VRF_SETTLEMENT_DEGRADED`, растёт `oldestLockAgeSlots` | Резервный экземпляр (`VRF_SETTLER_STANDBY_SLOTS`) подхватывает коммиты старше ~50 с. Если резерва нет — поднять реплику. Новые коммиты уже заблокированы circuit breaker'ом |
| Кончается SOL у settler | `low_balance` в логах (поле `signer`), затем `attempt_failed` с нехваткой средств | Пополнить кошелёк settler (`secrets/vrf_settler_secret_key`). Рента NFT возмещается при раскрытии, расходуются только комиссии |
| Оракул Switchboard не отвечает | `attempt_failed` с ошибкой gateway | Раскрыть коммит может только оракул, закреплённый при коммите. Ждать: через ~2 ч settler сам вернёт средства. Новые коммиты обходят такой оракул, как только у него устаревает heartbeat или пропадает живое здоровье (кэш до 30 с). Для барабана при затяжном сбое — guardian `paused` |
| Нет ни одного годного оракула / Crossbar недоступен | `[vrf] oracle refresh failed`, затем `503 VRF_ORACLE_UNAVAILABLE` | Новые коммиты не принимаются, деньги не списываются. Раскрытие уже сделанных коммитов от Crossbar не зависит: запрос идёт прямо в gateway закреплённого оракула. Ждать восстановления |
| Слот «залип» из-за бага (держатель закрыт) | `lock` указывает на несуществующий аккаунт | `vrf_slot_recover` (operator). Живой коммит так освободить нельзя |
| Аккаунт случайности ведёт себя странно | повторные ошибки на одном слоте | `POST /vrf/pool/retire` и `pool/add` взамен |
| Switchboard меняет интерфейс | `vrf.test.cjs` / девнет-смоук падают | Не деплоить. Обновить вендор-IDL и CPI, снова пройти смоук |

## 7. Смоук-тест на devnet

Где что проверяется:

- **Host-тесты** (`aof-core/src/security_checklist_tests.rs`, `cargo test` в CI): полный цикл commit → reveal → refund на реальных обработчиках с эмуляцией Switchboard, вектор броска.
- **Локальный валидатор** (`tests/aof_core.ts`, `tests/aof_extended.ts`): Switchboard там нет, то есть это состояние «пул пуст». Коммиты паков, кузницы, reroll и розыгрыша лотереи падают на загрузке `vrf_slot` раньше любых списаний. Билеты лотереи остаются в escrow раунда, приз и ранний возврат недоступны.
- **Devnet** (скрипт ниже): настоящий оракул и gateway.


`scripts/vrf/devnet-smoke.mjs` проверяет полный цикл на devnet-сборке:

1. здоровье пула;
2. открытие пака тестовым кошельком;
3. раскрытие сервисом (или самостоятельное);
4. `VrfSettled` в логах;
5. пересчёт исхода по опубликованному значению.

Переменные:

- `API` — URL бэкенда;
- `RPC_URL` — devnet;
- `PLAYER_KEYPAIR` — путь к тестовому кошельку с devnet SOL.
