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

Охват: **90 init/`init_if_needed` аккаунта** в шести программах — `aof_core` (65),
`aof_quests` (14), `aof_liquidity` (4), `aof_market` (2),
`aof_session_keys` (3), `aof_rebirth` (2).
(Шаг B пункта 12 удалил мёртвые `MigrateTool.tool_data` и `PlaceLimitOrder.order` — минус два аккаунта и
минус один долг.)

Сводка (из `docs/PAYER_MATRIX.json`):

| Категория | Аккаунтов |
|---|---|
| Должен платить игрок (`requiredPayer: player`) | 50 |
| Инфраструктура проекта (`requiredPayer: operator`) | 24 |
| Prepaid, возмещается поселенцу (`requiredPayer: cranker-deposit`) | 15 |
| Отдельный сервис проекта (`requiredPayer: service`, oracle) | 1 |
| **Долг: платит оператор, а должен игрок** | **5** |

Из 90 аккаунтов 62 — аккаунты игрока, 28 — глобальные. Фактически кошелёк оператора/authority
платит за 44 аккаунта: 39 законной глобальной инфраструктуры и 5 долгов.

## Долг до деплоя (5 записей, `status: debt`)

| Аккаунт | Платит сейчас | Почему это долг |
|---|---|---|
| `GrantSeasonXp.season_pass` (aof_core) | `authority` | сезонный пропуск платный (PurchaseSeasonPass, payer = user), а здесь создаётся бесплатно за счёт оператора — субсидия |
| `MintResource.player` (aof_core) | `authority` | создаётся профиль игрока: rent платит кошелёк authority-оператора. Долг до деплоя: claim/выдача должны быть подписаны кошельком игрока, либо профиль создаётся его собственным действием |
| `MintResourceOnce.player` (aof_core) | `authority` | то же, что MintResource.player: профиль игрока создаётся за счёт оператора на выдаче награды |
| `MintResourceOnce.reward_receipt` (aof_core) | `authority` | чек награды игрока (proof выплаты) оплачивает оператор; должен оплачивать игрок в своей claim-транзакции |
| `MintTool.tool_data` (aof_core) | `authority` | ToolData инструмента — собственность получателя, но получатель не подписант: rent платит оператор. Долг до деплоя: recipient должен подписывать и платить |

Полные формулировки «что делать» — в `docs/PAYER_MATRIX.md` и в плане remediation: player-funded
профиль, чек и `ToolData`, отдельный `init_season_pass` игроком, отказ backend от оплаты чужих ATA.

Правки не внесены: они меняют набор подписантов, а значит IDL и вызовы клиентов, и требуют
`anchor build` + validator'а, которых в песочнице нет. После решения владельца каждая правка
делается отдельным коммитом с `scripts/idl-sync-ts.py` и `check-idl-drift.py`.

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
* `aof_backend/src/routes/inbox.ts:206-215`, `aof_backend/src/routes/admin.ts:300+` — тот же паттерн.

Значит rent ATA игрока (≈0.00203 SOL) сейчас на проекте. Варианты: claim/выдача становятся
wallet-signed (платит игрок — согласуется с правилом и с prepaid-подходом), либо проект
фиксирует это как явную статью расходов с лимитом. Решение — за владельцем.

## Как перезапустить проверку

```bash
node scripts/payer-audit.mjs --write   # пересобрать docs/PAYER_MATRIX.{md,json}
node scripts/payer-audit.mjs --check   # гейт: политика, матрица, скрытые субсидии
node --test tests/readiness/           # весь readiness-набор, включая payer-audit
```
