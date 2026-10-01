# Product evidence по ресурсам (шаг A пункта 12)

Требование владельца: вариант `ResourceKind` не считается активным только потому, что он есть в enum.
Таблица собирается `node scripts/resource-usage.mjs --write` и проверяется `--check`
(`tests/readiness/resource-evidence.test.cjs`).

Статусы: `active` (есть on-chain источник и клиентское присутствие), `internal-only` (в цепочке/backend,
но игроку недоступен — например, только вход рецепта или админский mint), `candidate-dead` (клиент без
цепочки), `historical` (нигде). `on-chain source` = явная эмиссия в обработчике; `any-kind` пути
(`mint_resource` под authority) игроку не доступны и источником не считаются.

Сырые инвентари клиентов, по которым построено покрытие: `docs/CLIENT_INVENTORY.txt`
(`git ls-files frontend game`, `find frontend -maxdepth 6 -type f`, `find game -maxdepth 8 -type f`).

| Canonical ID | Display name | Frontend | Recipe | Asset | Backend | Game | On-chain source | On-chain sink | Status |
|---|---|---|---|---|---|---|---|---|---|
| Data | Data | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 2 обработчик(ов) | active |
| Circuit | Circuit | ✅ | — | ✅ | ✅ | — | 4 обработчик(ов) | 5 обработчик(ов) | active |
| Silicon | Silicon | ✅ | — | ✅ | — | — | 3 обработчик(ов) | 6 обработчик(ов) | active |
| Neuron | Neuron | ✅ | — | ✅ | ✅ | ✅ | 1 обработчик(ов) | 3 обработчик(ов) | active |
| Synapse | Synapse | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| Signal | Signal | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| Model | Model | ✅ | — | ✅ | ✅ | ✅ | 1 обработчик(ов) | — | active |
| Power | Power | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 2 обработчик(ов) | active |
| Compute | Compute | ✅ | — | ✅ | ✅ | — | — | — | candidate-dead |
| Dataset | Dataset | ✅ | — | ✅ | ✅ | — | 2 обработчик(ов) | — | active |
| BlueCore | Blue Core | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| PurpleCore | Purple Core | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| RedCore | Red Core | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| ClearQuartz | Clear Quartz | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| RoseQuartz | Rose Quartz | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| AmberQuartz | Amber Quartz | ✅ | — | ✅ | ✅ | — | — | — | candidate-dead |
| QuantumBit | Quantum Bit | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| NeuralChip | Neural Chip | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | 1 обработчик(ов) | active |
| PhotonBit | Photon Bit | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | — | active |
| BioChip | Bio Chip | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |
| CryoFluid | Cryo Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | — | active |
| VoltFluid | Volt Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | — | active |
| BioFluid | Bio Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | — | active |
| NanoFluid | Nano Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | — | active |
| QuantumFluid | Quantum Fluid | ✅ | — | ✅ | ✅ | — | 1 обработчик(ов) | — | active |
| SoulCore | Soul Core | ✅ | — | ✅ | ✅ | — | — | — | candidate-dead |
| Mind | Mind | ✅ | — | ✅ | ✅ | — | — | 1 обработчик(ов) | internal-only |

Итог: active — 17, candidate-dead — 3, internal-only — 7.

## Детали

### Data — active

* frontend: 21 файл(ов) (frontend/src/i18n/galleryBehaviorCopy.ts, frontend/src/i18n/galleryCryoCopy.ts, frontend/src/i18n/galleryMixCopy.ts, frontend/src/i18n/homeDetail.ts, …)
* game: —
* backend: 5 файл(ов) (aof_backend/src/lib/chainIndexerCore.ts, aof_backend/src/routes/daily.ts, aof_backend/src/routes/portfolio.ts, aof_backend/src/routes/query.ts, …)
* recipes: —
* assets: frontend/public/assets/icons/data.png, frontend/public/assets/icons/dataset.png, frontend/public/assets/icons/ui/building-data.png, frontend/public/assets/nfts/data-harvester-epic.jpg, frontend/public/assets/nfts/data-harvester-legendary.jpg, frontend/public/assets/nfts/data-harvester-rare.jpg, frontend/public/assets/nfts/data-harvester-uncommon.jpg, frontend/public/assets/nfts/data-harvester.jpg, frontend/public/assets/nfts/resources/data.jpg, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source: aof-core/src/instructions/exploration.rs
* on-chain sink: aof-core/src/instructions/craft.rs, aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Circuit — active

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/vrf.ts, aof_backend/src/routes/admin-config.ts)
* recipes: —
* assets: frontend/public/assets/icons/circuit.png, frontend/public/assets/nfts/resources/circuit.jpg
* on-chain source: aof-core/src/instructions/collect_mining.rs, aof-core/src/instructions/exploration.rs, aof-core/src/instructions/forge.rs, aof-core/src/instructions/season.rs
* on-chain sink: aof-core/src/instructions/craft.rs, aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/forge.rs, aof-core/src/instructions/rental_delegation.rs, aof-core/src/instructions/repair.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Silicon — active

* frontend: 11 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, …)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/silicon.png, frontend/public/assets/icons/ui/building-silicon.png, frontend/public/assets/nfts/resources/silicon.jpg, frontend/public/assets/nfts/silicon-extractor-epic.jpg, frontend/public/assets/nfts/silicon-extractor-legendary.jpg, frontend/public/assets/nfts/silicon-extractor-rare.jpg, frontend/public/assets/nfts/silicon-extractor-uncommon.jpg, frontend/public/assets/nfts/silicon-extractor.jpg
* on-chain source: aof-core/src/instructions/collect_mining.rs, aof-core/src/instructions/exploration.rs, aof-core/src/instructions/forge.rs
* on-chain sink: aof-core/src/instructions/craft.rs, aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/forge.rs, aof-core/src/instructions/rental_delegation.rs, aof-core/src/instructions/repair.rs, aof-core/src/instructions/start_milling.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Neuron — active

* frontend: 9 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteToolsCatalog.ts, …)
* game: game/godot/chain/spl_builders.gd, game/godot/products/inventory.gd
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neuron.png, frontend/public/assets/nfts/resources/neuron.jpg
* on-chain source: aof-core/src/instructions/collect_mining.rs
* on-chain sink: aof-core/src/instructions/craft.rs, aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/plant_seeds.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Synapse — active

* frontend: 15 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteDocs.ts, frontend/src/lib/marketUtils.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/synapse.png, frontend/public/assets/nfts/resources/synapse.jpg
* on-chain source: aof-core/src/instructions/harvest_wheat.rs
* on-chain sink: aof-core/src/instructions/start_milling.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Signal — active

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteDocs.ts, frontend/src/i18n/siteGuide.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/signal.png, frontend/public/assets/nfts/resources/signal.jpg
* on-chain source: aof-core/src/instructions/collect_flour.rs
* on-chain sink: aof-core/src/instructions/start_baking.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Model — active

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteEconomy.ts, frontend/src/i18n/siteGuide.ts, …)
* game: game/godot/chain/candy_machine.gd
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/model.png, frontend/public/assets/nfts/resources/model.jpg
* on-chain source: aof-core/src/instructions/collect_bread.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Power — active

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/wellCopy.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/economySimulatorV2.ts, aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/power.png, frontend/public/assets/nfts/resources/power.jpg
* on-chain source: aof-core/src/instructions/collect_well_water.rs
* on-chain sink: aof-core/src/instructions/craft.rs, aof-core/src/instructions/start_baking.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Compute — candidate-dead

* frontend: 5 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, frontend/src/pages/farm/OvenPanel.tsx, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/compute.png, frontend/public/assets/nfts/resources/compute.jpg
* on-chain source: —
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### Dataset — active

* frontend: 6 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/dataset.png, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source: aof-core/src/instructions/collect_mining.rs, aof-core/src/instructions/exploration.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### BlueCore — internal-only

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/blue-core.png, frontend/public/assets/nfts/resources/blue-core.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### PurpleCore — internal-only

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/purple-core.png, frontend/public/assets/nfts/resources/purple-core.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### RedCore — internal-only

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/red-core.png, frontend/public/assets/nfts/resources/red-core.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### ClearQuartz — internal-only

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/clear-quartz.png, frontend/public/assets/nfts/resources/clear-quartz.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### RoseQuartz — internal-only

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/rose-quartz.png, frontend/public/assets/nfts/resources/rose-quartz.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
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
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### NeuralChip — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neural-chip.png, frontend/public/assets/nfts/resources/neural-chip.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### PhotonBit — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/photon-bit.png, frontend/public/assets/nfts/resources/photon-bit.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### BioChip — internal-only

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/bio-chip.png, frontend/public/assets/nfts/resources/bio-chip.jpg
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft_recipe.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### CryoFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/cryo-fluid.png, frontend/public/assets/nfts/resources/cryo-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### VoltFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/volt-fluid.png, frontend/public/assets/nfts/resources/volt-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### BioFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/bio-fluid.png, frontend/public/assets/nfts/resources/bio-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### NanoFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/nano-fluid.png, frontend/public/assets/nfts/resources/nano-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: —
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

### QuantumFluid — active

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/quantum-fluid.png, frontend/public/assets/nfts/resources/quantum-fluid.jpg
* on-chain source: aof-core/src/instructions/craft_recipe.rs
* on-chain sink: —
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
* on-chain source: —
* on-chain sink: aof-core/src/instructions/craft.rs
* any-kind path: aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs

