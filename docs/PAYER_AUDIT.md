# Аудит payer'ов init-аккаунтов (пункт 10 плана)

Правило владельца (№4 из постановки): **игрок платит rent/fees своих действий и
аккаунтов; проект — только deployment, Config, global registry, инфра и
admin/security; субсидий нет.** Cranker не платит за игрока; authority не
субсидирует.

Документ отвечает на вопрос «кто фактически платит за каждый `init`/`init_if_needed`
аккаунт» и какие расхождения остались.

## Методика

* Скрипт разбирает все `#[derive(Accounts)]`-контексты шести программ
  (`aof-core`, `aof-session-keys`, `aof-market`, `aof-liquidity`, `aof-quests`,
  `aof-rebirth`) и выписывает для каждого init-аккаунта `payer` и `seeds`.
* Для каждого аккаунта проверено по коду: (а) кто экономический бенефициар
  аккаунта, (б) может ли он подписать транзакцию, (в) если не может — внёс ли он
  стоимость аккаунта заранее (prepaid).
* Итог: **92 init-аккаунта**; 46 — платит сам игрок, 25 — инфраструктура
  проекта, 15 — prepaid (игрок внёс заранее, cranker получает возмещение),
  **5 — отклонения**, 1 — отклонение в мёртвом коде.

Сводка по категориям: 86 из 92 соответствуют правилу; 6 требуют решения (5 живых
+ 1 мёртвый).

## Почему prepaid-пути — не субсидия (доказательства)

Асинхронные механики (pack, reroll, exploration, drum, potato) исполняет cranker,
которого не было при коммите игрока. Программа не может заставить отсутствующего
игрока подписать `init`, поэтому стоимость аккаунтов вносится **заранее**, а
cranker'у возвращается ровно авансированная сумма:

* `aof-core/src/vrf.rs:545` — `tool_settlement_rent()` = rent(Mint) + rent(ATA) +
  rent(ToolData); коммиты pack/reroll кладут её в `deposit_lamports`
  (`pack_open_commit.rs:26,59`; `reroll_random.rs:60`);
* `aof-core/src/instructions/settlement.rs:67` — `reimburse_settler()` возвращает
  cranker'у `min(deposit, fronted_rent)` в той же транзакции
  (`pack_open_reveal.rs:69-71`, `reroll_random.rs:198-199`, `reroll_random.rs`
  expire-путь);
* `ExploreReveal.user_wood/user_stone` и `Drum*/Potato*.user_mascot/user_potato` —
  `init_if_needed` для ATA, которые **уже существуют**: коммит списывает
  стоимость именно с них (`exploration.rs:52-56`,
  `drum_commit.rs:88-99`, `potato_spin.rs:63`), а `user` в reveal-контекстах
  привязан к `commit.user` (`exploration_commit.user`,
  `drum_commit.user`). Ветка init недостижима, payer не тратится.
  Дополнительно drum и potato сейчас закрыты (`require!(false, …)`), т.е. это
  документированная, а не работающая механика.

## Отклонения (требуют решения владельца)

| # | Аккаунт | payer сейчас | Чей аккаунт | Почему отклонение | Варианты |
|---|---|---|---|---|---|
| 1 | `aof-core::MintResource.player` | `authority` | профиль игрока (`Player`) | authority платит rent профиля нового игрока. Комментарий в коде прямо говорит «mint_resource не должен блокироваться отсутствием профиля» — это осознанный bootstrap, но он субсидия | (a) сделать профиль обязательным (`Account<Player>`, ошибка на отсутствие), (b) player-signed claim, где платит игрок, (в) оставить как исключение с лимитом |
| 2 | `aof-core::MintResourceOnce.player` | `authority` | профиль игрока | то же + путь inbox-награды | то же |
| 3 | `aof-core::MintResourceOnce.reward_receipt` | `authority` | чек награды игрока (proof выплаты) | rent чека платит проект; чек — доказательство игрока | сделать claim-транзакцию подписанной кошельком игрока (fee payer = игрок) |
| 4 | `aof-core::MintTool.tool_data` | `authority` | `ToolData` игрока-получателя | `recipient` не подписант, поэтому платит authority; но ToolData — собственность игрока | (a) `recipient: Signer` + `payer = recipient` (меняет IDL: isSigner), (b) оставить как явное исключение для минта по покупке |
| 5 | `aof-core::GrantSeasonXp.season_pass` | `authority` | сезонный пропуск игрока | пропуск — платный (`PurchaseSeasonPass`, payer = user); эта инструкция создаёт его бесплатно за счёт проекта | (a) требовать существующий `SeasonPass`, (b) выдать бесплатный пропуск явным решением продукта |

Мёртвый код: `MigrateTool.tool_data` (payer = `migration_authority`) — инструкция
всегда отключена и входит в список на удаление (пункт 12), отдельного фикса не
требует.

### Что уже корректно, хотя выглядит подозрительно

* `aof-session-keys::SessionCreate.session` (payer = `authority`) — здесь
  `authority` это **кошелёк игрока**: seeds `[SESSION_SEED, authority.key()]`,
  `trust.user == authority.key()`, поле `mut` + подпись. Игрок платит сам.
* `TrustSnapshotUpdate.trust` (payer = `oracle_authority`) — снапшот доверия
  создаёт oracle-сервис проекта, это не актив игрока.
* `LpDeposit.lp_pool` / `pool_vault` (payer = `user`) — первый вкладчик создаёт
  общий пул; аккаунт общий, но платит участник. Отмечаем как осознанное
  отклонение от «проект платит за инфру», безопасное (никто не обязан
  депозитить).
* `ChallengeInit.challenge_round`, `InitPool.pool`, `Initial…`-конфиги,
  реестры, `WeatherCrank.weather_state`, `VrfPoolAdd.vrf_slot` — инфраструктура
  проекта, платит authority. Соответствует правилу.

## Отдельная находка: субсидия на уровне backend

Программа не может управлять тем, кто создаёт ATA **вне** программы, а backend
делает это за игрока:

* `aof_backend/src/routes/resources.ts:92-95` — `createUserAta` с
  `AUTHORITY_PUBKEY` как payer (idempotent ATA инструкция);
* `aof_backend/src/routes/inbox.ts:206-215` и `admin.ts:300+` — тот же паттерн
  для награждений и админских выдач.

Итог: rent ATA игрока (≈0.00203 SOL на аккаунт) сейчас платит проект. Чтобы
соблюсти правило №4, claim/выдача должны быть **подписаны кошельком игрока**
(тогда он же платит и за ATA, и за профиль, и за чек), либо проект должен
зафиксировать это как явную статью расходов с лимитом.

## Что НЕ сделано в этом пункте (и почему)

Изменения payer'ов меняют набор подписантов (`Signer`) и, следовательно, IDL и
клиентские вызовы; проверять их нужно компиляцией `anchor build` и validator'ом,
которых в этой песочнице нет. Поэтому:

* код не менялся — ни одна инструкция не получила/не потеряла подписанта;
* расхождения зафиксированы здесь и вынесены на решение владельца (5 пунктов
  выше);
* после решения правки делаются отдельным коммитом с прогоном
  `scripts/idl-sync-ts.py`, `check-idl-drift.py` и validator-сценариев.

## Полная таблица (92 аккаунта)

| Программа | Контекст.поле | payer | Кто платит по правилу №4 | Вердикт |
|---|---|---|---|---|
| aof-liquidity | `InitLpConfig.lp_config` | `authority` | инфраструктура | ✅ |
| aof-liquidity | `LpDeposit.lp_pool` | `user` | сам игрок | ✅ |
| aof-liquidity | `LpDeposit.lp_position` | `user` | сам игрок | ✅ |
| aof-liquidity | `LpDeposit.pool_vault` | `user` | сам игрок | ✅ |
| aof-market | `InitConfig.config` | `authority` | инфраструктура | ✅ |
| aof-market | `InitPool.pool` | `authority` | инфраструктура | ✅ |
| aof-market | `PlaceLimitOrder.order` | `maker` | сам игрок | ✅ |
| aof-quests | `AchievementUnlock.achievement_record` | `user` | сам игрок | ✅ |
| aof-quests | `ChallengeContribute.contribution` | `user` | сам игрок | ✅ |
| aof-quests | `ChallengeInit.challenge_round` | `authority` | инфраструктура | ✅ |
| aof-quests | `DrumCommitCtx.drum_commit` | `user` | сам игрок | ✅ |
| aof-quests | `DrumExpire.user_mascot` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof-quests | `DrumReveal.user_mascot` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof-quests | `InitPotatoBank.potato_bank` | `authority` | инфраструктура | ✅ |
| aof-quests | `InitPotatoBank.potato_vault` | `authority` | инфраструктура | ✅ |
| aof-quests | `InitQuestConfig.quest_config` | `authority` | инфраструктура | ✅ |
| aof-quests | `PotatoSpinCommit.potato_commit` | `user` | сам игрок | ✅ |
| aof-quests | `PotatoSpinExpire.user_potato` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof-quests | `PotatoSpinReveal.user_potato` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof-quests | `QuestInit.quest_template` | `authority` | инфраструктура | ✅ |
| aof-quests | `QuestVrfPoolAdd.vrf_slot` | `authority` | инфраструктура | ✅ |
| aof-rebirth | `DoRebirth.rebirth_record` | `user` | сам игрок | ✅ |
| aof-rebirth | `InitRebirthConfig.rebirth_config` | `authority` | инфраструктура | ✅ |
| aof-session-keys | `InitSkConfig.config` | `authority` | инфраструктура | ✅ |
| aof-session-keys | `SessionCreate.session` | `authority` | сам игрок | ✅ |
| aof-session-keys | `TrustSnapshotUpdate.trust` | `oracle_authority` | инфраструктура | ✅ |
| aof_core | `AuctionCreateCtx.auction` | `seller` | сам игрок | ✅ |
| aof_core | `BuyLotteryTicket.lottery_ticket` | `buyer` | сам игрок | ✅ |
| aof_core | `BuyLotteryTicket.ticket_counter` | `buyer` | сам игрок | ✅ |
| aof_core | `CollectWellWater.well_state` | `user` | сам игрок | ✅ |
| aof_core | `CollectorStake.player` | `user` | сам игрок | ✅ |
| aof_core | `CollectorStake.staked_collector` | `user` | сам игрок | ✅ |
| aof_core | `Craft.new_tool_data` | `user` | сам игрок | ✅ |
| aof_core | `CraftOrderCreateCtx.craft_order` | `creator` | сам игрок | ✅ |
| aof_core | `DepositGas.gastank` | `user` | сам игрок | ✅ |
| aof_core | `ExploreReveal.user_stone` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `ExploreReveal.user_wood` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `ForgeAttemptCommit.enchant_slot` | `user` | сам игрок | ✅ |
| aof_core | `ForgeAttemptCommit.forge_commit` | `user` | сам игрок | ✅ |
| aof_core | `GrantSeasonXp.season_pass` | `authority` | ОТКЛОНЕНИЕ | ❌ |
| aof_core | `HarvestWheat.energy_account` | `user` | сам игрок | ✅ |
| aof_core | `InitCraftEconomy.craft_economy` | `authority` | инфраструктура | ✅ |
| aof_core | `InitIssuanceCap.issuance_cap` | `authority` | инфраструктура | ✅ |
| aof_core | `InitLotteryRound.lottery_round` | `authority` | инфраструктура | ✅ |
| aof_core | `InitMaterialMints.material_mints` | `authority` | инфраструктура | ✅ |
| aof_core | `InitPackConfig.pack_config` | `authority` | инфраструктура | ✅ |
| aof_core | `InitRarityCounter.rarity_counter` | `authority` | инфраструктура | ✅ |
| aof_core | `InitRerollConfig.reroll_config` | `authority` | инфраструктура | ✅ |
| aof_core | `InitSeason.season` | `authority` | инфраструктура | ✅ |
| aof_core | `InitVaultGuard.vault_guard` | `authority` | инфраструктура | ✅ |
| aof_core | `Initialize.config` | `authority` | инфраструктура | ✅ |
| aof_core | `MarketplaceList.listing` | `seller` | сам игрок | ✅ |
| aof_core | `MigrateTool.tool_data` | `migration_authority` | отклонение (мёртвый код) | 🚫 |
| aof_core | `MintResource.player` | `authority` | ОТКЛОНЕНИЕ | ❌ |
| aof_core | `MintResourceOnce.player` | `authority` | ОТКЛОНЕНИЕ | ❌ |
| aof_core | `MintResourceOnce.reward_receipt` | `authority` | ОТКЛОНЕНИЕ | ❌ |
| aof_core | `MintTool.tool_data` | `authority` | ОТКЛОНЕНИЕ | ❌ |
| aof_core | `OfferCreateCtx.offer` | `buyer` | сам игрок | ✅ |
| aof_core | `PackOpenCommit.pack_commit` | `user` | сам игрок | ✅ |
| aof_core | `PackOpenReveal.mint` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `PackOpenReveal.tool_data` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `PackOpenReveal.user_token` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `PlaceBuyOrder.order` | `maker` | сам игрок | ✅ |
| aof_core | `PlaceBuyOrderV2.order` | `maker` | сам игрок | ✅ |
| aof_core | `PlaceSellOrder.order` | `maker` | сам игрок | ✅ |
| aof_core | `PlaceSellOrderV2.order` | `maker` | сам игрок | ✅ |
| aof_core | `PlantSeeds.energy_account` | `user` | сам игрок | ✅ |
| aof_core | `PlantSeeds.farm_tile` | `user` | сам игрок | ✅ |
| aof_core | `PurchaseSeasonPass.season_pass` | `user` | сам игрок | ✅ |
| aof_core | `ReferralBindCtx.referral_link` | `referred` | сам игрок | ✅ |
| aof_core | `ReferralBindCtx.referrer_stats` | `referred` | сам игрок | ✅ |
| aof_core | `RegisterCollectorMint.entry` | `authority` | инфраструктура | ✅ |
| aof_core | `RentalListCtx.rental_listing` | `owner` | сам игрок | ✅ |
| aof_core | `RentalStartCtx.rental_agreement` | `renter` | сам игрок | ✅ |
| aof_core | `Reroll.new_tool_data` | `user` | сам игрок | ✅ |
| aof_core | `RerollRandomCommit.reroll_commit` | `user` | сам игрок | ✅ |
| aof_core | `RerollRandomExpire.new_mint` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `RerollRandomExpire.new_token` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `RerollRandomExpire.new_tool_data` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `RerollRandomReveal.new_mint` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `RerollRandomReveal.new_token` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `RerollRandomReveal.new_tool_data` | `cranker` | prepaid (игрок внёс заранее) | ✅ |
| aof_core | `StartBaking.energy_account` | `user` | сам игрок | ✅ |
| aof_core | `StartBaking.oven_state` | `user` | сам игрок | ✅ |
| aof_core | `StartExplorationCommit.exploration_commit` | `user` | сам игрок | ✅ |
| aof_core | `StartExplorationCommit.exploration_state` | `user` | сам игрок | ✅ |
| aof_core | `StartMilling.energy_account` | `user` | сам игрок | ✅ |
| aof_core | `StartMilling.mill_state` | `user` | сам игрок | ✅ |
| aof_core | `StartMining.player` | `user` | сам игрок | ✅ |
| aof_core | `StartMiningDelegated.player` | `user` | сам игрок | ✅ |
| aof_core | `VrfPoolAdd.vrf_slot` | `operator` | инфраструктура | ✅ |
| aof_core | `WeatherCrank.weather_state` | `cranker` | инфраструктура | ✅ |
