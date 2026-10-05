# Матрица плательщиков

Создаёт `node scripts/payer-audit.mjs --write`; гейт — `--check`. Политика (кто ДОЛЖЕН платить) — `security/payer-policy.json`.
Принцип: **игрок платит комиссию сети и rent своих аккаунтов; проект — только deployment и глобальную инфраструктуру.**

Инициализаций аккаунтов: **95**; нарушают принцип (долг до деплоя): **0**.

## Все инициализации

| Программа | Инструкция | Аккаунт | Тип | init | payer в коде | Владелец | Должен платить | Статус | Асинхронный settlement | Возврат |
|---|---|---|---|---|---|---|---|---|---|---|
| aof_core | AuctionCreateCtx | auction | Auction | init_if_needed | seller | player | player | ok | — | — |
| aof_core | BuyLotteryTicket | lottery_ticket | LotteryTicket | init | buyer | player | player | ok | — | — |
| aof_core | BuyLotteryTicket | ticket_counter | LotteryTicketCounter | init_if_needed | buyer | player | player | ok | — | — |
| aof_core | CollectorStake | player | Player | init_if_needed | user | player | player | ok | — | — |
| aof_core | CollectorStake | staked_collector | StakedCollector | init | user | player | player | ok | — | — |
| aof_core | CollectPower | grid_state | GridState | init_if_needed | user | player | player | ok | — | — |
| aof_core | Craft | new_tool_data | ToolData | init_if_needed | user | player | player | ok | — | — |
| aof_core | CraftOrderCreateCtx | craft_order | CraftOrder | init | creator | player | player | ok | — | — |
| aof_core | DepositGas | gastank | GasTank | init_if_needed | user | player | player | ok | — | — |
| aof_core | ExchangeDataEnergy | energy_account | EnergyAccount | init_if_needed | user | player | player | ok | — | — |
| aof_core | ExploreReveal | user_circuit | TokenAccount | init_if_needed | cranker (оператор) | player | cranker-deposit | ok | игрок вносит стоимость заранее собственным действием на коммите — ATA создаётся им же | возврат не нужен: ветка init не выполняется, lamports не тратятся |
| aof_core | ExploreReveal | user_silicon | TokenAccount | init_if_needed | cranker (оператор) | player | cranker-deposit | ok | игрок вносит стоимость заранее собственным действием на коммите — ATA создаётся им же | возврат не нужен: ветка init не выполняется, lamports не тратятся |
| aof_core | ForgeAttemptCommit | enchant_slot | EnchantSlot | init_if_needed | user | player | player | ok | — | — |
| aof_core | ForgeAttemptCommit | forge_commit | ForgeCommit | init | user | player | player | ok | — | — |
| aof_core | GrantSeasonXp | claim_cursor | SeasonXpClaimCursor | init_if_needed | user | player | player | ok | — | — |
| aof_core | GrantSeasonXp | season_pass | SeasonPass | init_if_needed | user | player | player | ok | — | — |
| aof_core | HarvestSynapse | energy_account | EnergyAccount | init_if_needed | user | player | player | ok | — | — |
| aof_core | InitCraftEconomy | craft_economy | CraftEconomy | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | Initialize | config | Config | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitIssuanceCap | issuance_cap | IssuanceCap | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitLotteryRound | lottery_round | LotteryRound | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitMaterialMints | material_mints | MaterialMints | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitPackConfig | pack_config | PackConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitPlayer | player_profile | Player | init | player | player | player | ok | — | — |
| aof_core | InitRarityCounter | rarity_counter | RarityCounter | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitRerollConfig | reroll_config | RerollConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitSeason | season | Season | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | InitSeasonPass | season_pass | SeasonPass | init | player | player | player | ok | — | — |
| aof_core | InitVaultGuard | vault_guard | VaultGuard | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | MarketplaceList | listing | Listing | init | seller | player | player | ok | — | — |
| aof_core | MintResourceOnce | player | Player | init_if_needed | payer | player | player | ok | — | — |
| aof_core | MintResourceOnce | reward_receipt | RewardReceipt | init | payer | player | player | ok | — | — |
| aof_core | MintTool | tool_data | ToolData | init_if_needed | payer | player | player | ok | — | — |
| aof_core | OfferCreateCtx | offer | Offer | init | buyer | player | player | ok | — | — |
| aof_core | PackOpenCommit | pack_commit | PackCommit | init | user | player | player | ok | — | — |
| aof_core | PackOpenReveal | mint | Mint | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | PackOpenReveal | tool_data | ToolData | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | PackOpenReveal | user_token | TokenAccount | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | PlaceBuyOrder | order | ResourceOrder | init | maker | player | player | ok | — | — |
| aof_core | PlaceBuyOrderV2 | order | ResourceOrderV2 | init | maker | player | player | ok | — | — |
| aof_core | PlaceSellOrder | order | ResourceOrder | init | maker | player | player | ok | — | — |
| aof_core | PlaceSellOrderV2 | order | ResourceOrderV2 | init | maker | player | player | ok | — | — |
| aof_core | PlantNeuron | energy_account | EnergyAccount | init_if_needed | user | player | player | ok | — | — |
| aof_core | PlantNeuron | lab_tile | LabTile | init_if_needed | user | player | player | ok | — | — |
| aof_core | PurchaseSeasonPass | season_pass | SeasonPass | init_if_needed | user | player | player | ok | — | — |
| aof_core | ReferralBindCtx | referral_link | ReferralLink | init | referred | player | player | ok | — | — |
| aof_core | ReferralBindCtx | referrer_stats | ReferrerStats | init_if_needed | referred | player | player | ok | — | — |
| aof_core | RegisterCollectorMint | entry | CollectorAllowEntry | init | authority (оператор) | global | operator | ok | — | — |
| aof_core | RentalListCtx | rental_listing | RentalListing | init | owner | player | player | ok | — | — |
| aof_core | RentalStartCtx | rental_agreement | RentalAgreement | init | renter | player | player | ok | — | — |
| aof_core | Reroll | new_tool_data | ToolData | init_if_needed | user | player | player | ok | — | — |
| aof_core | RerollRandomCommit | reroll_commit | RerollCommit | init | user | player | player | ok | — | — |
| aof_core | RerollRandomExpire | new_mint | Mint | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | RerollRandomExpire | new_token | TokenAccount | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | RerollRandomExpire | new_tool_data | ToolData | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | RerollRandomReveal | new_mint | Mint | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | RerollRandomReveal | new_token | TokenAccount | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | RerollRandomReveal | new_tool_data | ToolData | init | cranker (оператор) | player | cranker-deposit | ok | игрок платит tool_settlement_rent в deposit_lamports на коммите (vrf.rs:545, pack_open_commit.rs:26) | settlement::reimburse_settler возвращает rent поселенцу в той же транзакции (settlement.rs:67) |
| aof_core | SetToolMetadataUris | tool_metadata_registry | ToolMetadataRegistry | init_if_needed | authority (оператор) | global | operator | ok | — | — |
| aof_core | StartExplorationCommit | exploration_commit | ExplorationCommit | init | user | player | player | ok | — | — |
| aof_core | StartExplorationCommit | exploration_state | ExplorationState | init_if_needed | user | player | player | ok | — | — |
| aof_core | StartMining | player | Player | init_if_needed | user | player | player | ok | — | — |
| aof_core | StartMiningDelegated | player | Player | init_if_needed | user | player | player | ok | — | — |
| aof_core | StartModelTraining | energy_account | EnergyAccount | init_if_needed | user | player | player | ok | — | — |
| aof_core | StartModelTraining | model_state | ModelState | init_if_needed | user | player | player | ok | — | — |
| aof_core | StartSignalProcessing | energy_account | EnergyAccount | init_if_needed | user | player | player | ok | — | — |
| aof_core | StartSignalProcessing | signal_state | SignalState | init_if_needed | user | player | player | ok | — | — |
| aof_core | UseFlask | energy_account | EnergyAccount | init_if_needed | user | player | player | ok | — | — |
| aof_core | VrfPoolAdd | vrf_slot | VrfSlot | init | operator (оператор) | global | operator | ok | — | — |
| aof_core | WeatherCrank | weather_state | WeatherState | init_if_needed | cranker (оператор) | global | operator | ok | — | — |
| aof_liquidity | InitLpConfig | lp_config | LpConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_liquidity | LpDeposit | lp_pool | LpPool | init_if_needed | user | global | player | ok | — | — |
| aof_liquidity | LpDeposit | lp_position | LpPosition | init_if_needed | user | global | player | ok | — | — |
| aof_liquidity | LpDeposit | pool_vault | TokenAccount | init_if_needed | user | global | player | ok | — | — |
| aof_market | InitConfig | config | MarketConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_market | InitPool | pool | HotMarketPool | init | authority (оператор) | global | operator | ok | — | — |
| aof_quests | AchievementUnlock | achievement_record | AchievementRecord | init | user | player | player | ok | — | — |
| aof_quests | ChallengeContribute | contribution | ChallengeContribution | init | user | player | player | ok | — | — |
| aof_quests | ChallengeInit | challenge_round | ChallengeRound | init | authority (оператор) | global | operator | ok | — | — |
| aof_quests | DrumCommitCtx | drum_commit | DrumCommit | init | user | player | player | ok | — | — |
| aof_quests | DrumExpire | user_mascot | TokenAccount | init_if_needed | cranker (оператор) | player | cranker-deposit | ok | игрок вносит стоимость заранее собственным действием на коммите — ATA создаётся им же | возврат не нужен: ветка init не выполняется, lamports не тратятся |
| aof_quests | DrumReveal | user_mascot | TokenAccount | init_if_needed | cranker (оператор) | player | cranker-deposit | ok | игрок вносит стоимость заранее собственным действием на коммите — ATA создаётся им же | возврат не нужен: ветка init не выполняется, lamports не тратятся |
| aof_quests | InitMindBank | mind_bank | MindBank | init | authority (оператор) | global | operator | ok | — | — |
| aof_quests | InitMindBank | mind_vault | TokenAccount | init | authority (оператор) | global | operator | ok | — | — |
| aof_quests | InitQuestConfig | quest_config | QuestConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_quests | MindSpinCommit | mind_commit | MindCommit | init | user | player | player | ok | — | — |
| aof_quests | MindSpinExpire | user_mind | TokenAccount | init_if_needed | cranker (оператор) | player | cranker-deposit | ok | игрок вносит стоимость заранее собственным действием на коммите — ATA создаётся им же | возврат не нужен: ветка init не выполняется, lamports не тратятся |
| aof_quests | MindSpinReveal | user_mind | TokenAccount | init_if_needed | cranker (оператор) | player | cranker-deposit | ok | игрок вносит стоимость заранее собственным действием на коммите — ATA создаётся им же | возврат не нужен: ветка init не выполняется, lamports не тратятся |
| aof_quests | QuestInit | quest_template | QuestTemplate | init | authority (оператор) | global | operator | ok | — | — |
| aof_quests | QuestVrfPoolAdd | vrf_slot | VrfSlot | init | authority (оператор) | global | operator | ok | — | — |
| aof_rebirth | DoRebirth | rebirth_record | RebirthRecord | init_if_needed | user | player | player | ok | — | — |
| aof_rebirth | InitRebirthConfig | rebirth_config | RebirthConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_session_keys | InitSkConfig | config | SkConfig | init | authority (оператор) | global | operator | ok | — | — |
| aof_session_keys | SessionCreate | session | SessionToken | init | authority | player | player | ok | — | — |
| aof_session_keys | TrustSnapshotUpdate | trust | TrustSnapshot | init_if_needed | oracle_authority | global | service | ok | — | — |
