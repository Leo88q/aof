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
| **Долг: платит оператор, а должен игрок** | **0** |

Фактически кошелёк оператора/authority платит за глобальную инфраструктуру и за 3 оставшихся
долга (см. ниже).

## Долг до деплоя: закрыт (0 записей `status: debt`)

Все пять долгов закрыты на уровне исходников (коммиты 4–5; статус
**source-aligned manually; generated validation pending** — `anchor build` и validator не запускались):

| Аккаунт | Как закрыт |
|---|---|
| `MintResource.player` | `init_if_needed, payer = authority` убран целиком: профиль в операторской выдаче не создаётся, handler читает его как `Option<Player>` и работает по базовым перкам |
| `MintTool.tool_data` | добавлен `payer: Signer` с констрейнтом `payer == recipient`; ToolData и ATA получателя оплачивает он, authority только авторизует |
| `MintResourceOnce.player` | claim игрока: `payer: Signer` с констрейнтом `payer == token_account.owner`, профиль — `init_if_needed, payer = payer` |
| `MintResourceOnce.reward_receipt` | `init, payer = payer`: чек награды — доказательство игрока и оплачивается им |
| `GrantSeasonXp.season_pass` | `init_if_needed` удалён; пропуск создаёт сам игрок в новой `init_season_pass` (`init, payer = player`), выдача XP меняет только существующий |

Гейт (`node scripts/payer-audit.mjs --check`) больше не видит ни одной субсидии оператора, и
`tests/readiness/payer-audit.test.cjs` проверяет это число. Возврат `init_if_needed`/`payer = authority`
на любой из этих аккаунтов ловится как устаревшая запись политики или скрытая субсидия.

Приёмочные проверки поведения (10) — `tests/aof_payer_funding.ts`; в песочнице они **не запускались**.

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
rent уже существующего ATA; асинхронные награды — player claim. Коммит 5 уже перевёл на эту схему
`/inbox/claim` (ATA игрока создаётся в его транзакции, ATA казны проект оплачивает отдельно и только
если её нет). Коммит 6 закрывает остальные роуты; проверка — `tests/readiness/ata-funding.test.cjs`.

## Как перезапустить проверку

```bash
node scripts/payer-audit.mjs --write   # пересобрать docs/PAYER_MATRIX.{md,json}
node scripts/payer-audit.mjs --check   # гейт: политика, матрица, скрытые субсидии
node --test tests/readiness/           # весь readiness-набор, включая payer-audit
```
