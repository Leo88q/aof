# Product evidence по ресурсам (шаг A пункта 12)

Требование владельца: вариант `ResourceKind` не считается активным только потому, что он есть в enum.
Таблица собирается `node scripts/resource-usage.mjs --write` и проверяется `--check`
(`tests/readiness/resource-evidence.test.cjs`).

Статусы: `active` (есть on-chain источник и клиентское присутствие), `internal-only` (в цепочке/backend,
но игроку недоступен: только вход рецепта, топливо или админский mint), `candidate-dead` (клиент без
цепочки), `historical` (нигде). `on-chain source`/`sink` — сигналы по блокам функций: в блоке есть
`mint_to`/`mint_out!` (источник) или `token::burn`/`burn_in!`/`TRIP_COST` (сток) и при этом упомянут
ресурс. Сигнал грубее семантики: блок `craft` одновременно жжёт входы и минтит NFT, поэтому статусы
пяти спорных ресурсов (Data, Dataset, Compute, AmberQuartz, SoulCore) зафиксированы курируемо в
`statuses` и проверяются гейтом на противоречие коду.

Сырые инвентари клиентов, по которым построено покрытие: `docs/CLIENT_INVENTORY.txt`
(`git ls-files frontend game`, `find frontend -maxdepth 6 -type f`, `find game -maxdepth 8 -type f`).

| Canonical ID | Display name | Frontend | Recipe | Asset | Backend | Game | On-chain source | On-chain sink | Status |
|---|---|---|---|---|---|---|---|---|---|
| Data | Data | ✅ | — | ✅ | ✅ | — | 3 обработчик(ов) | 5 обработчик(ов) | internal-only |
| Circuit | Circuit | ✅ | — | ✅ | ✅ | — | 5 обработчик(ов) | 9 обработчик(ов) | active |
| Silicon | Silicon | ✅ | — | ✅ | — | — | 4 обработчик(ов) | 9 обработчик(ов) | active |
| Neuron | Neuron | ✅ | — | ✅ | ✅ | ✅ | 3 обработчик(ов) | 4 обработчик(ов) | active |
| Synapse | Synapse | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| Signal | Signal | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| Model | Model | ✅ | — | ✅ | ✅ | ✅ | 1 обработчик(ов) | — | active |
| Power | Power | ✅ | — | ✅ | ✅ | — | 3 обработчик(ов) | 3 обработчик(ов) | active |
| Compute | Compute | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| Dataset | Dataset | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| BlueCore | Blue Core | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| PurpleCore | Purple Core | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| RedCore | Red Core | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| ClearQuartz | Clear Quartz | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| RoseQuartz | Rose Quartz | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| AmberQuartz | Amber Quartz | ✅ | — | ✅ | ✅ | — | — | — | candidate-dead |
| QuantumBit | Quantum Bit | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| NeuralChip | Neural Chip | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| PhotonBit | Photon Bit | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| BioChip | Bio Chip | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| CryoFluid | Cryo Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| VoltFluid | Volt Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| BioFluid | Bio Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| NanoFluid | Nano Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| QuantumFluid | Quantum Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| SoulCore | Soul Core | ✅ | — | ✅ | ✅ | — | — | — | candidate-dead |
| Mind | Mind | ✅ | — | ✅ | ✅ | — | 2 обработчик(ов) | 2 обработчик(ов) | internal-only |

Итог: internal-only — 4, active — 21, candidate-dead — 2.

## Курируемые статусы (спорные сигналы)

| Ресурс | Статус | Почему |
|---|---|---|
| Data | internal-only | жжётся в exploration-трипе (TRIP_COST_FOOD); собственного источника для игрока нет — только authority-минт mint_resource и награды, поэтому источником не считается |
| Compute | internal-only | топливо печи (start_baking, fuel_kind=1), собственного источника для игрока нет |
| Dataset | internal-only | аналогично Data: TRIP_COST_MEAT в exploration, источник — только authority-минт |
| AmberQuartz | candidate-dead | sand_yellow не упоминается ни в одном обработчике: только enum, MaterialMints, orderbook-маппинг и фронтенд-каталог |
| SoulCore | candidate-dead | love_heart нигде не читается и не минтится: только enum, реестр минтов и фронтенд-каталог |
| Mind | internal-only | потребляется craft/reroll как potato-стоимость; mint_to в этих блоках выпускает NFT инструмента, а не Mind, поэтому источника нет |

## Детали

### Data — internal-only

* frontend: 21 файл(ов) (frontend/src/i18n/galleryBehaviorCopy.ts, frontend/src/i18n/galleryCryoCopy.ts, frontend/src/i18n/galleryMixCopy.ts, frontend/src/i18n/homeDetail.ts, …)
* game: —
* backend: 5 файл(ов) (aof_backend/src/lib/chainIndexerCore.ts, aof_backend/src/routes/daily.ts, aof_backend/src/routes/portfolio.ts, aof_backend/src/routes/query.ts, …)
* recipes: —
* assets: frontend/public/assets/icons/data.png, frontend/public/assets/icons/dataset.png, frontend/public/assets/icons/ui/building-data.png, frontend/public/assets/nfts/data-harvester-epic.jpg, frontend/public/assets/nfts/data-harvester-legendary.jpg, frontend/public/assets/nfts/data-harvester-rare.jpg, frontend/public/assets/nfts/data-harvester-uncommon.jpg, frontend/public/assets/nfts/data-harvester.jpg, frontend/public/assets/nfts/resources/data.jpg, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/reroll.rs#handler
* on-chain sink: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/reroll.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Circuit — active

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/vrf.ts, aof_backend/src/routes/admin-config.ts)
* recipes: —
* assets: frontend/public/assets/icons/circuit.png, frontend/public/assets/nfts/resources/circuit.jpg
* on-chain source: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/forge.rs#expire_handler, aof-core/src/instructions/reroll.rs#handler, aof-core/src/instructions/season.rs#claim_reward_handler
* on-chain sink: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/forge.rs#commit_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/rental_delegation.rs#repair_handler, aof-core/src/instructions/repair.rs#handler, aof-core/src/instructions/reroll.rs#handler, aof-core/src/instructions/start_baking.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Silicon — active

* frontend: 11 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, …)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/silicon.png, frontend/public/assets/icons/ui/building-silicon.png, frontend/public/assets/nfts/resources/silicon.jpg, frontend/public/assets/nfts/silicon-extractor-epic.jpg, frontend/public/assets/nfts/silicon-extractor-legendary.jpg, frontend/public/assets/nfts/silicon-extractor-rare.jpg, frontend/public/assets/nfts/silicon-extractor-uncommon.jpg, frontend/public/assets/nfts/silicon-extractor.jpg
* on-chain source: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/forge.rs#expire_handler, aof-core/src/instructions/reroll.rs#handler
* on-chain sink: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/forge.rs#commit_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/rental_delegation.rs#repair_handler, aof-core/src/instructions/repair.rs#handler, aof-core/src/instructions/reroll.rs#handler, aof-core/src/instructions/start_milling.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Neuron — active

* frontend: 9 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteToolsCatalog.ts, …)
* game: game/godot/chain/spl_builders.gd, game/godot/products/inventory.gd
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neuron.png, frontend/public/assets/nfts/resources/neuron.jpg
* on-chain source: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/reroll.rs#handler
* on-chain sink: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/plant_seeds.rs#handler, aof-core/src/instructions/reroll.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Synapse — active

* frontend: 15 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteDocs.ts, frontend/src/lib/marketUtils.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/synapse.png, frontend/public/assets/nfts/resources/synapse.jpg
* on-chain source: aof-core/src/instructions/harvest_wheat.rs#handler
* on-chain sink: aof-core/src/instructions/start_milling.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Signal — active

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteDocs.ts, frontend/src/i18n/siteGuide.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/signal.png, frontend/public/assets/nfts/resources/signal.jpg
* on-chain source: aof-core/src/instructions/collect_flour.rs#handler
* on-chain sink: aof-core/src/instructions/start_baking.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Model — active

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteEconomy.ts, frontend/src/i18n/siteGuide.ts, …)
* game: game/godot/chain/candy_machine.gd
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/model.png, frontend/public/assets/nfts/resources/model.jpg
* on-chain source: aof-core/src/instructions/collect_bread.rs#handler
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Power — active

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/wellCopy.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/economySimulatorV2.ts, aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/power.png, frontend/public/assets/nfts/resources/power.jpg
* on-chain source: aof-core/src/instructions/collect_well_water.rs#handler, aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/reroll.rs#handler
* on-chain sink: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/reroll.rs#handler, aof-core/src/instructions/start_baking.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Compute — internal-only

* frontend: 5 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, frontend/src/pages/farm/OvenPanel.tsx, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/compute.png, frontend/public/assets/nfts/resources/compute.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/start_baking.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Dataset — internal-only

* frontend: 6 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/dataset.png, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/exploration.rs#start_commit_handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### BlueCore — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/blue-core.png, frontend/public/assets/nfts/resources/blue-core.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### PurpleCore — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/purple-core.png, frontend/public/assets/nfts/resources/purple-core.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### RedCore — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/red-core.png, frontend/public/assets/nfts/resources/red-core.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### ClearQuartz — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/clear-quartz.png, frontend/public/assets/nfts/resources/clear-quartz.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### RoseQuartz — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/rose-quartz.png, frontend/public/assets/nfts/resources/rose-quartz.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### AmberQuartz — candidate-dead

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/amber-quartz.png, frontend/public/assets/nfts/resources/amber-quartz.jpg
* on-chain source: —
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### QuantumBit — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/quantum-bit.png, frontend/public/assets/nfts/resources/quantum-bit.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### NeuralChip — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neural-chip.png, frontend/public/assets/nfts/resources/neural-chip.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### PhotonBit — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/photon-bit.png, frontend/public/assets/nfts/resources/photon-bit.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### BioChip — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/bio-chip.png, frontend/public/assets/nfts/resources/bio-chip.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### CryoFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/cryo-fluid.png, frontend/public/assets/nfts/resources/cryo-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### VoltFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/volt-fluid.png, frontend/public/assets/nfts/resources/volt-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### BioFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/bio-fluid.png, frontend/public/assets/nfts/resources/bio-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### NanoFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/nano-fluid.png, frontend/public/assets/nfts/resources/nano-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### QuantumFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/quantum-fluid.png, frontend/public/assets/nfts/resources/quantum-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink: aof-core/src/instructions/craft_recipe.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### SoulCore — candidate-dead

* frontend: 1 файл(ов) (frontend/src/site/content/resources.ts)
* game: —
* backend: 1 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts)
* recipes: —
* assets: frontend/public/assets/nfts/resources/soul-core.jpg
* on-chain source: —
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Mind — internal-only

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteGlossary.ts, frontend/src/i18n/translations.ts, …)
* game: —
* backend: 1 файл(ов) (aof_backend/src/lib/questGenerator.ts)
* recipes: —
* assets: frontend/public/assets/icons/mind.png, frontend/public/assets/nfts/resources/mind.jpg
* on-chain source: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/reroll.rs#handler
* on-chain sink: aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/reroll.rs#handler
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

