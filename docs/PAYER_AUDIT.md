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

Охват: **92 init/`init_if_needed` аккаунта** в шести программах — `aof_core` (66),
`aof_quests` (14), `aof_liquidity` (4), `aof_market` (3), `aof_session_keys` (3),
`aof_rebirth` (2).

Сводка (из `docs/PAYER_MATRIX.json`):

| Категория | Аккаунтов |
|---|---|
| Платит сам игрок (`payer: player`) | 52 |
| Инфраструктура проекта (`payer: operator`) | 24 |
| Prepaid, возмещается поселенцу (`payer: cranker-deposit`) | 15 |
| Отдельный сервис проекта (`payer: service`, oracle) | 1 |
| **Долг: платит оператор, а должен игрок** | **6** |

Из 92 аккаунтов 64 — аккаунты игрока, 28 — глобальные; в коде кошелёк оператора платит за 45.

## Долг до деплоя (6 записей, `status: debt`)

| Аккаунт | Платит сейчас | Почему это долг | Что делать |
|---|---|---|---|
| `MintResource.player` | `authority` | rent профиля игрока платит кошелёк оператора — скрытая субсидия | claim/выдача должны быть подписаны кошельком игрока, либо профиль создаётся его собственным действием |
| `MintResourceOnce.player` | `authority` | то же на выдаче награды | то же |
| `MintResourceOnce.reward_receipt` | `authority` | чек награды — proof игрока, а платит проект | вынести оплату в claim-транзакцию игрока |
| `MintTool.tool_data` | `authority` | `ToolData` — собственность получателя, но получатель не подписант | сделать `recipient: Signer` и плательщиком; это меняет IDL (`isSigner`) и клиентов |
| `GrantSeasonXp.season_pass` | `authority` | пропуск платный (`PurchaseSeasonPass`, `payer = user`), здесь создаётся бесплатно | требовать существующий `SeasonPass` либо оформить бесплатную выдачу явным решением продукта |
| `MigrateTool.tool_data` | `migration_authority` | мёртвый код: инструкция always-disabled | уйдёт вместе с мёртвым кодом в пункте 12, отдельного фикса не требует |

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
