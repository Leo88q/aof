# Аудит плательщиков (пункт 10 плана)

Правило владельца: **игрок платит комиссию сети и rent своих аккаунтов; проект — только
deployment, Config, глобальные реестры, инфраструктура и admin/security. Субсидий нет:
cranker не платит за игрока, кошелёк authority не оплачивает чужие аккаунты.**

Документ объясняет, как это правило проверяется машинно, где остался долг и почему
prepaid-механики субсидией не являются.

## Как проверяется

* Инструмент: `node scripts/payer-audit.mjs --check` (генерация — `--write`).
* Политика «кто ДОЛЖЕН платить»: `security/payer-policy.json` — по записи на каждый
  init-аккаунт (`owner`, `payer`, `status`, `reason`, для асинхронных — `settlement`/`refund`).
* Сгенерированная матрица: `docs/PAYER_MATRIX.md` и `docs/PAYER_MATRIX.json`.
* Гейт в readiness: `tests/readiness/payer-audit.test.cjs` (`node --test tests/readiness/`).
  Тесты доказывают, что гейт живой: снятый долг (`ok` вместо `debt`) падает как «скрытая
  субсидия», отсутствующая или устаревшая запись — тоже.

Охват: **89 init/`init_if_needed` аккаунтов** в шести программах.
(Шаг B пункта 12 удалил мёртвые `MigrateTool.tool_data` и `PlaceLimitOrder.order` — минус два аккаунта
и минус один долг. Коммит 4 payer-remediation убрал создание `MintResource.player` из операторской
выдачи: аккаунт больше не инициализируется программой вообще, поэтому из матрицы ушла и его запись —
минус ещё один аккаунт и один долг.)

Сводка (из `docs/PAYER_MATRIX.json`):

| Категория | Аккаунтов |
|---|---|
| Должен платить игрок (`requiredPayer: player`) | 50 |
| Инфраструктура проекта (`requiredPayer: operator`) | 24 |
| Prepaid, возмещается поселенцу (`requiredPayer: cranker-deposit`) | 15 |
| Отдельный сервис проекта (`requiredPayer: service`, oracle) | 1 |
| **Долг: платит оператор, а должен игрок** | **3** |

Фактически кошелёк оператора/authority платит за глобальную инфраструктуру и за 3 оставшихся
долга (см. ниже).

## Долг до деплоя (3 записи, `status: debt`)

Коммит 4 (ветка `arena/01a0f648-aof`) закрыл два долга из пяти — на уровне исходников:

| Было | Стало |
|---|---|
| `MintResource.player` — `init_if_needed, payer = authority` создавал профиль игрока за счёт оператора | профиль в этой инструкции не создаётся: `player` — опциональный read-only PDA, handler читает его как `Option<Player>`, а сама выдача идёт по базовым перкам. Профиль создаётся действием игрока |
| `MintTool.tool_data` — `init_if_needed, payer = authority` | в контексте появился `payer: Signer` с констрейнтом `payer.key() == recipient.key()`; `ToolData` и ATA получателя оплачивает и подписывает получатель, authority только авторизует минт (частично подписанная транзакция) |

Остаются три записи, все в операторских выдачах наград/сезона (закрываются коммитами 5–6):

| Аккаунт | Платит сейчас | Почему это долг |
|---|---|---|
| `GrantSeasonXp.season_pass` (aof_core) | `authority` | сезонный пропуск платный (PurchaseSeasonPass, payer = user), а здесь создаётся бесплатно за счёт оператора — субсидия. План: отдельный `init_season_pass` игроком, `grant_season_xp` меняет только существующий |
| `MintResourceOnce.player` (aof_core) | `authority` | профиль игрока создаётся за счёт оператора на выдаче награды. План: награда — claim игрока (`player: Signer`, `payer = player`) |
| `MintResourceOnce.reward_receipt` (aof_core) | `authority` | чек награды игрока (proof выплаты) оплачивает оператор; должен оплачивать игрок в своей claim-транзакции |

Правки не внесены: они меняют набор подписантов, а значит IDL и вызовы клиентов, и требуют
`anchor build` + validator'а, которых в песочнице нет. После решения владельца каждая правка
делается отдельным коммитом с `scripts/idl-sync-ts.py` и `check-idl-drift.py`.
Статус исходников: **source-aligned manually; generated validation pending**.

## Почему prepaid-пути — не субсидия (доказательства)

Асинхронные механики исполняет cranker, которого не было при коммите игрока, поэтому стоимость
аккаунтов вносится заранее и возвращается поселенцу:

* `aof-core/src/vrf.rs:545` — `tool_settlement_rent()` = rent(Mint) + rent(ATA) + rent(ToolData);
  коммиты pack/reroll кладут её в `deposit_lamports` (`pack_open_commit.rs:26,59`,
  `reroll_random.rs:60`);
* `aof-core/src/instructions/settlement.rs:67` — `reimburse_settler()` возвращает поселенцу
  `min(deposit, fronted_rent)` в той же транзакции (`pack_open_reveal.rs:69-71`,
  `reroll_random.rs:198-199` и expire-путь);
* `ExploreReveal.user_wood/user_stone`, `Drum*/Potato*.user_mascot/user_potato` — `init_if_needed`
  для ATA, которые уже существуют: коммит списывает стоимость именно с них
  (`exploration.rs:52-56`, `drum_commit.rs:88-99`, `potato_spin.rs:63`), а `user` в reveal-контекстах
  привязан к `commit.user`. Ветка init недостижима, payer не тратится. Drum и potato к тому же
  сейчас закрыты (`require!(false, …)`).

## Что ещё не субсидия, хотя выглядит так

* `aof_session_keys.SessionCreate.session` (`payer = authority`) — в этой программе `authority`
  это **кошелёк владельца сессии**: seeds `[SESSION_SEED, authority.key()]`,
  `trust.user == authority.key()`, поле `mut` + подпись. Гейт распознаёт это правилом самооплаты
  (`seeds` содержат `<payer>.key()`), в матрице запись `player`/`ok`.
* `aof_liquidity.LpDeposit.lp_pool` / `pool_vault` — общий пул создаёт первый вкладчик; владелец
  аккаунта программа, платит участник. `owner: global`, `payer: player`.
* `aof_session_keys.TrustSnapshotUpdate.trust` — снапшот доверия пишет oracle-сервис проекта; это
  не кошелёк authority-оператора, поэтому отдельный `payer: service` (гейт не даёт объявить
  оператором подписанта, у которого нет operator-ограничений, и наоборот).

## Отдельная находка: субсидия вне программы

Программа не управляет тем, кто создаёт ATA **вне** программы, а backend делает это за игрока:

* `aof_backend/src/routes/resources.ts:92-95` — `createAssociatedTokenAccountIdempotentInstruction`
  с `AUTHORITY_PUBKEY` как плательщиком;
* `aof_backend/src/routes/inbox.ts:206-215`, `aof_backend/src/routes/admin.ts:258-261`, `408-418`,
  `506-509`, `581`, `aof_backend/src/routes/hotMarket.ts:109-110` — тот же паттерн.

Решение владельца: ATA в message транзакции игрока, payer = кошелёк игрока, подпись игрока,
authority подписывает только authorization-инструкции; ленивое/идемпотентное создание; quote без
rent уже существующего ATA; асинхронные награды — player claim. Закрывается коммитами 5 (claim) и 6
(остальные роуты), проверка — `tests/readiness/ata-funding.test.cjs`.

## Как перезапустить проверку

```bash
node scripts/payer-audit.mjs --write   # пересобрать docs/PAYER_MATRIX.{md,json}
node scripts/payer-audit.mjs --check   # гейт: политика, матрица, скрытые субсидии
node --test tests/readiness/           # весь readiness-набор, включая payer-audit
```
