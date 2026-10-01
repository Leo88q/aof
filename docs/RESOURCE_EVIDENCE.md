# Product evidence по ресурсам (шаг A пункта 12)

Требование владельца: вариант `ResourceKind` не считается активным только потому, что он есть в enum.
Таблица собирается `node scripts/resource-usage.mjs --write` и проверяется `--check`
(`tests/readiness/resource-evidence.test.cjs`); ручных статусов у гейта нет.

Методика (учитывает dynamic dispatch, иначе вывод «нет источника» ложен):

* `on-chain source`/`sink` — строка с именем ресурса относится к ближайшему вызову в той же
  функции: `mint_to`/`mint_out!` — источник, `token::burn`/`burn_in!`/`TRIP_COST` — сток. Оконный
  разбор (а не «в файле есть mint_to») нужен потому, что один обработчик и жжёт входы, и минтит выход;
* `resource_kind_for_tool` в `collect_mining.rs` — майнинг выбирает ресурс по типу инструмента
  (не литералом в месте минта), поэтому такой источник приписывается ресурсу из таблицы;
* `expected_resource_mint` в ордербуке — индекс kind → минт: любой ресурс, попавший к игроку,
  торгуем, но это сток-в-обмен, а не источник;
* рецепты `craft_recipe.rs` — входы (какие поля жгутся) и выходы (какой kind минтится) по `recipe_id`;
* generic-выдача (`mint_resource` — admin/authority, `mint_resource_once` — подпись игрока-плательщика)
  умеет выпустить ЛЮБОЙ kind: эти пути отмечены флагами `admin_mintable`/`player_claimable`
  и сами по себе не делают ресурс доступным игроку по его действию.

Статусы (взаимоисключающие, описывают природу ресурса, а не связность): `active-player`
(ресурс бывает балансом игрока и/или входит в его экономику — в том числе когда источника
пока нет), `active-internal` (никогда не баланс игрока, только protocol state), `candidate-dead`
(подтверждённого product flow нет — остались каталог/реестр и generic-пути), `dead` (нет и записи
в реестре; удаление — только с разрешения владельца).

Флаги (по одному признаку каждый): `player_held`, `ui_visible`, `tradable`, `has_player_source`,
`has_player_sink`, `has_admin_source`, `recipe_input`, `recipe_output`, `mining_output`,
`generic_claim_output`, `internal_only`. Экономическая связность — отдельная ось `economy_issue`
(`missing_source`/`missing_sink`), она НЕ понижает player-ресурс до internal.

Сырые инвентари клиентов: `docs/CLIENT_INVENTORY.txt` (воспроизводимо из `git ls-files -- frontend game`).

| Canonical ID | Display name | Frontend | Recipe | Asset | Backend | Game | playerSource | playerSink | tradable | admin/claim | Статус | economy_issue |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Data | Data | ✅ | — | ✅ | ✅ | — | 0 | 4 | ✅ | admin/claim | active-player | missing_source |
| Circuit | Circuit | ✅ | — | ✅ | ✅ | — | 3 | 8 | ✅ | admin/claim | active-player | — |
| Silicon | Silicon | ✅ | — | ✅ | — | — | 2 | 8 | ✅ | admin/claim | active-player | — |
| Neuron | Neuron | ✅ | — | ✅ | ✅ | ✅ | 2 | 3 | ✅ | admin/claim | active-player | — |
| Synapse | Synapse | ✅ | — | ✅ | ✅ | — | 1 | 1 | ✅ | admin/claim | active-player | — |
| Signal | Signal | ✅ | — | ✅ | ✅ | — | 1 | 1 | ✅ | admin/claim | active-player | — |
| Model | Model | ✅ | — | ✅ | ✅ | ✅ | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| Power | Power | ✅ | — | ✅ | ✅ | — | 1 | 2 | ✅ | admin/claim | active-player | — |
| Compute | Compute | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| Dataset | Dataset | ✅ | — | ✅ | ✅ | — | 2 | 1 | ✅ | admin/claim | active-player | — |
| BlueCore | Blue Core | ✅ | — | ✅ | — | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| PurpleCore | Purple Core | ✅ | — | ✅ | — | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| RedCore | Red Core | ✅ | — | ✅ | — | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| ClearQuartz | Clear Quartz | ✅ | — | ✅ | — | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| RoseQuartz | Rose Quartz | ✅ | — | ✅ | — | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| AmberQuartz | Amber Quartz | ✅ | — | ✅ | — | — | 0 | 0 | ✅ | admin/claim | candidate-dead | — |
| QuantumBit | Quantum Bit | ✅ | — | ✅ | — | — | 1 | 1 | ✅ | admin/claim | active-player | — |
| NeuralChip | Neural Chip | ✅ | — | ✅ | — | — | 1 | 1 | ✅ | admin/claim | active-player | — |
| PhotonBit | Photon Bit | ✅ | — | ✅ | — | — | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| BioChip | Bio Chip | ✅ | — | ✅ | — | — | 0 | 1 | ✅ | admin/claim | active-player | missing_source |
| CryoFluid | Cryo Fluid | ✅ | — | ✅ | — | — | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| VoltFluid | Volt Fluid | ✅ | — | ✅ | — | — | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| BioFluid | Bio Fluid | ✅ | — | ✅ | — | — | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| NanoFluid | Nano Fluid | ✅ | — | ✅ | — | — | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| QuantumFluid | Quantum Fluid | ✅ | — | ✅ | — | — | 1 | 0 | ✅ | admin/claim | active-player | missing_sink |
| SoulCore | Soul Core | ✅ | — | ✅ | — | — | 0 | 0 | ✅ | admin/claim | candidate-dead | — |
| Mind | Mind | ✅ | — | ✅ | ✅ | — | 0 | 2 | ✅ | admin/claim | active-player | missing_source |

Итог: active-player: 25, candidate-dead: 2.

## Разрывы цепочки, видимые из кода

Это не приговор ресурсу, а вход для решения владельца о каноне:

* рецепты требуют ресурс, который игрок нигде не может получить (ни майнинга, ни рецепта,
  ни награды; получить можно только проектной выдачей): BioChip, BlueCore, ClearQuartz, Data, PurpleCore, RedCore, RoseQuartz;
* рецепты выпускают ресурс, который затем нигде не потребляется: BioFluid, CryoFluid, NanoFluid, PhotonBit, QuantumFluid, VoltFluid;
* generic-выдача открыта для всех 27 kinds: admin-минт — да,
  player claim — да (поэтому отсутствие литерала
  `ResourceKind::X` в файле само по себе не доказывает отсутствие источника).

## Пояснения к статусам

Пояснение выводится из флагов (см. `statusNote` в `scripts/resource-usage.mjs`), а не назначается руками.

| Ресурс | Статус | economy_issue | Пояснение |
|---|---|---|---|
| Data | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| Circuit | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| Silicon | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| Neuron | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| Synapse | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| Signal | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| Model | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| Power | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| Compute | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| Dataset | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| BlueCore | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| PurpleCore | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| RedCore | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| ClearQuartz | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| RoseQuartz | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| AmberQuartz | candidate-dead | — | подтверждённого product flow нет: только каталог/реестр (UI, индекс ордербука, mint_for_kind) и generic-пути, открытые для всех kinds; удаление — только с разрешения владельца |
| QuantumBit | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| NeuralChip | active-player | — | ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account |
| PhotonBit | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| BioChip | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |
| CryoFluid | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| VoltFluid | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| BioFluid | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| NanoFluid | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| QuantumFluid | active-player | missing_sink | баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap |
| SoulCore | candidate-dead | — | подтверждённого product flow нет: только каталог/реестр (UI, индекс ордербука, mint_for_kind) и generic-пути, открытые для всех kinds; удаление — только с разрешения владельца |
| Mind | active-player | missing_source | баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap |

## Детали

### Data — active-player

* frontend: 21 файл(ов) (frontend/src/i18n/galleryBehaviorCopy.ts, frontend/src/i18n/galleryCryoCopy.ts, frontend/src/i18n/galleryMixCopy.ts, frontend/src/i18n/homeDetail.ts, …)
* game: —
* backend: 5 файл(ов) (aof_backend/src/lib/chainIndexerCore.ts, aof_backend/src/routes/daily.ts, aof_backend/src/routes/portfolio.ts, aof_backend/src/routes/query.ts, …)
* recipes: —
* assets: frontend/public/assets/icons/data.png, frontend/public/assets/icons/dataset.png, frontend/public/assets/icons/ui/building-data.png, frontend/public/assets/nfts/data-harvester-epic.jpg, frontend/public/assets/nfts/data-harvester-legendary.jpg, frontend/public/assets/nfts/data-harvester-rare.jpg, frontend/public/assets/nfts/data-harvester-uncommon.jpg, frontend/public/assets/nfts/data-harvester.jpg, frontend/public/assets/nfts/resources/data.jpg, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/referral.rs#upgrade_handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 3, recipe 6; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Circuit — active-player

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/vrf.ts, aof_backend/src/routes/admin-config.ts)
* recipes: —
* assets: frontend/public/assets/icons/circuit.png, frontend/public/assets/nfts/resources/circuit.jpg
* on-chain source (литерал): aof-core/src/instructions/forge.rs#expire_handler, aof-core/src/instructions/season.rs#claim_reward_handler
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/forge.rs#commit_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/rental_delegation.rs#repair_handler, aof-core/src/instructions/repair.rs#handler, aof-core/src/instructions/start_model_training.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler, aof-core/src/instructions/season.rs#claim_reward_handler
* майнинг-выдача: aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 5; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=true, generic_claim_output=true, internal_only=false

### Silicon — active-player

* frontend: 11 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, …)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/silicon.png, frontend/public/assets/icons/ui/building-silicon.png, frontend/public/assets/nfts/resources/silicon.jpg, frontend/public/assets/nfts/silicon-extractor-epic.jpg, frontend/public/assets/nfts/silicon-extractor-legendary.jpg, frontend/public/assets/nfts/silicon-extractor-rare.jpg, frontend/public/assets/nfts/silicon-extractor-uncommon.jpg, frontend/public/assets/nfts/silicon-extractor.jpg
* on-chain source (литерал): aof-core/src/instructions/forge.rs#expire_handler
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/forge.rs#commit_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/rental_delegation.rs#repair_handler, aof-core/src/instructions/repair.rs#handler, aof-core/src/instructions/start_signal_processing.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* майнинг-выдача: aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 4; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=true, generic_claim_output=true, internal_only=false

### Neuron — active-player

* frontend: 10 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/neuralLabCopy.ts, frontend/src/i18n/resourceLeads.ts, …)
* game: game/godot/products/inventory.gd
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neuron.png, frontend/public/assets/nfts/resources/neuron.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/plant_neuron.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* майнинг-выдача: aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 5; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=true, generic_claim_output=true, internal_only=false

### Synapse — active-player

* frontend: 7 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/synapse.png, frontend/public/assets/nfts/resources/synapse.jpg
* on-chain source (литерал): aof-core/src/instructions/harvest_synapse.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/start_signal_processing.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/harvest_synapse.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Signal — active-player

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteGuide.ts, frontend/src/i18n/siteLore.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/signal.png, frontend/public/assets/nfts/resources/signal.jpg
* on-chain source (литерал): aof-core/src/instructions/collect_signal.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/start_model_training.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_signal.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Model — active-player

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteEconomy.ts, frontend/src/i18n/siteGuide.ts, …)
* game: game/godot/chain/candy_machine.gd
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/model.png, frontend/public/assets/nfts/resources/model.jpg
* on-chain source (литерал): aof-core/src/instructions/collect_model.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_model.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Power — active-player

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/wellCopy.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/economySimulatorV2.ts, aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/power.png, frontend/public/assets/nfts/resources/power.jpg
* on-chain source (литерал): aof-core/src/instructions/collect_power.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/start_model_training.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_power.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Compute — active-player

* frontend: 5 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, frontend/src/pages/farm/OvenPanel.tsx, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/compute.png, frontend/public/assets/nfts/resources/compute.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/start_model_training.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Dataset — active-player

* frontend: 6 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/dataset.png, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/exploration.rs#start_commit_handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* майнинг-выдача: aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=true, generic_claim_output=true, internal_only=false

### BlueCore — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/blue-core.png, frontend/public/assets/nfts/resources/blue-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 0; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### PurpleCore — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/purple-core.png, frontend/public/assets/nfts/resources/purple-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 7; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### RedCore — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/red-core.png, frontend/public/assets/nfts/resources/red-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 1; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### ClearQuartz — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/clear-quartz.png, frontend/public/assets/nfts/resources/clear-quartz.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 2; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### RoseQuartz — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/rose-quartz.png, frontend/public/assets/nfts/resources/rose-quartz.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 6; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### AmberQuartz — candidate-dead

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/amber-quartz.png, frontend/public/assets/nfts/resources/amber-quartz.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=false, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### QuantumBit — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/quantum-bit.png, frontend/public/assets/nfts/resources/quantum-bit.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 3; выход recipe 0
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### NeuralChip — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/neural-chip.png, frontend/public/assets/nfts/resources/neural-chip.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 4; выход recipe 1
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### PhotonBit — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/photon-bit.png, frontend/public/assets/nfts/resources/photon-bit.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 2
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### BioChip — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/bio-chip.png, frontend/public/assets/nfts/resources/bio-chip.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 7; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=true, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### CryoFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/cryo-fluid.png, frontend/public/assets/nfts/resources/cryo-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 3
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### VoltFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/volt-fluid.png, frontend/public/assets/nfts/resources/volt-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 4
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### BioFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/bio-fluid.png, frontend/public/assets/nfts/resources/bio-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 5
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### NanoFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/nano-fluid.png, frontend/public/assets/nfts/resources/nano-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 6
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### QuantumFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/quantum-fluid.png, frontend/public/assets/nfts/resources/quantum-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 7
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=true, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=true, mining_output=false, generic_claim_output=true, internal_only=false

### SoulCore — candidate-dead

* frontend: 1 файл(ов) (frontend/src/site/content/resources.ts)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/nfts/resources/soul-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=false, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=false, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false

### Mind — active-player

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteGlossary.ts, frontend/src/i18n/translations.ts, …)
* game: —
* backend: 1 файл(ов) (aof_backend/src/lib/questGenerator.ts)
* recipes: —
* assets: frontend/public/assets/icons/mind.png, frontend/public/assets/nfts/resources/mind.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/reroll.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* майнинг-выдача: —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: player_held=true, ui_visible=true, tradable=true, has_player_source=false, has_player_sink=true, has_admin_source=true, recipe_input=false, recipe_output=false, mining_output=false, generic_claim_output=true, internal_only=false
