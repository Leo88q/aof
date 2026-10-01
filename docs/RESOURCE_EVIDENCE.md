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

Статусы (взаимоисключающие): `active-player` (есть путь получения игроком), `active-internal`
(участвует в экономике, но получить может только проект), `candidate-dead` (только UI/каталог и
generic-пути), `dead` (нигде). Отдельно — флаги `has_player_source`, `has_player_sink`, `tradable`,
`craft_input`, `craft_output`, `admin_mintable`, `player_claimable`, `ui_visible`.

Сырые инвентари клиентов: `docs/CLIENT_INVENTORY.txt` (воспроизводимо из `git ls-files -- frontend game`).

| Canonical ID | Display name | Frontend | Recipe | Asset | Backend | Game | playerSource | playerSink | tradable | craft in/out | admin/claim | Статус |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Data | Data | ✅ | — | ✅ | ✅ | — | 0 | 4 | ✅ | in | admin/claim | active-internal |
| Circuit | Circuit | ✅ | — | ✅ | ✅ | — | 3 | 8 | ✅ | in | admin/claim | active-player |
| Silicon | Silicon | ✅ | — | ✅ | — | — | 2 | 8 | ✅ | in | admin/claim | active-player |
| Neuron | Neuron | ✅ | — | ✅ | ✅ | ✅ | 2 | 3 | ✅ | in | admin/claim | active-player |
| Synapse | Synapse | ✅ | — | ✅ | ✅ | — | 1 | 1 | ✅ | — | admin/claim | active-player |
| Signal | Signal | ✅ | — | ✅ | ✅ | — | 1 | 1 | ✅ | — | admin/claim | active-player |
| Model | Model | ✅ | — | ✅ | ✅ | ✅ | 1 | 0 | ✅ | — | admin/claim | active-player |
| Power | Power | ✅ | — | ✅ | ✅ | — | 1 | 2 | ✅ | — | admin/claim | active-player |
| Compute | Compute | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | — | admin/claim | active-internal |
| Dataset | Dataset | ✅ | — | ✅ | ✅ | — | 2 | 1 | ✅ | — | admin/claim | active-player |
| BlueCore | Blue Core | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | in | admin/claim | active-internal |
| PurpleCore | Purple Core | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | in | admin/claim | active-internal |
| RedCore | Red Core | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | in | admin/claim | active-internal |
| ClearQuartz | Clear Quartz | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | in | admin/claim | active-internal |
| RoseQuartz | Rose Quartz | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | in | admin/claim | active-internal |
| AmberQuartz | Amber Quartz | ✅ | — | ✅ | ✅ | — | 0 | 0 | ✅ | — | admin/claim | candidate-dead |
| QuantumBit | Quantum Bit | ✅ | — | ✅ | ✅ | — | 1 | 1 | ✅ | in/out | admin/claim | active-player |
| NeuralChip | Neural Chip | ✅ | — | ✅ | ✅ | — | 1 | 1 | ✅ | in/out | admin/claim | active-player |
| PhotonBit | Photon Bit | ✅ | — | ✅ | ✅ | — | 1 | 0 | ✅ | out | admin/claim | active-player |
| BioChip | Bio Chip | ✅ | — | ✅ | ✅ | — | 0 | 1 | ✅ | in | admin/claim | active-internal |
| CryoFluid | Cryo Fluid | ✅ | — | ✅ | ✅ | — | 1 | 0 | ✅ | out | admin/claim | active-player |
| VoltFluid | Volt Fluid | ✅ | — | ✅ | ✅ | — | 1 | 0 | ✅ | out | admin/claim | active-player |
| BioFluid | Bio Fluid | ✅ | — | ✅ | ✅ | — | 1 | 0 | ✅ | out | admin/claim | active-player |
| NanoFluid | Nano Fluid | ✅ | — | ✅ | ✅ | — | 1 | 0 | ✅ | out | admin/claim | active-player |
| QuantumFluid | Quantum Fluid | ✅ | — | ✅ | ✅ | — | 1 | 0 | ✅ | out | admin/claim | active-player |
| SoulCore | Soul Core | ✅ | — | ✅ | ✅ | — | 0 | 0 | ✅ | — | admin/claim | candidate-dead |
| Mind | Mind | ✅ | — | ✅ | ✅ | — | 0 | 2 | ✅ | — | admin/claim | active-internal |

Итог: active-player: 16, active-internal: 9, candidate-dead: 2.

## Разрывы цепочки, видимые из кода

Это не приговор ресурсу, а вход для решения владельца о каноне:

* рецепты требуют ресурс, который игрок нигде не может получить (ни майнинга, ни рецепта,
  ни награды; получить можно только проектной выдачей): BioChip, BlueCore, ClearQuartz, Data, PurpleCore, RedCore, RoseQuartz;
* рецепты выпускают ресурс, который затем нигде не потребляется: BioFluid, CryoFluid, NanoFluid, PhotonBit, QuantumFluid, VoltFluid;
* generic-выдача открыта для всех 27 kinds: admin-минт — да,
  player claim — да (поэтому отсутствие литерала
  `ResourceKind::X` в файле само по себе не доказывает отсутствие источника).

## Предварительные пояснения (не меняют классификацию)

Это комментарии к автоматически выведенному статусу, а не решение владельца о каноне.

| Ресурс | Пояснение |
|---|---|
| Data | internal-only предварительно: тратится как стоимость трипа (TRIP_COST_FOOD), источника для игрока нет; удаление запрещено до утверждения канона |
| Dataset | internal-only предварительно: тратится в exploration (TRIP_COST_MEAT) и одновременно выдаётся как mining-награда инструментов data_harvester/quantum_transmitter — generic-путь, требует решения владельца |
| Compute | internal-only предварительно: топливо печи (start_baking, fuel_kind=1), источника для игрока нет |
| Mind | internal-only предварительно: оплачивает craft/reroll как potato-стоимость; удаление запрещено до подтверждения |
| AmberQuartz | candidate-dead: ни источника, ни стока, ни рецепта; есть только UI-каталог, индекс ордербука и generic admin/claim-выдача |
| SoulCore | candidate-dead: то же, что AmberQuartz; удаление запрещено до утверждения владельцем |

## Детали

### Data — active-internal

* frontend: 21 файл(ов) (frontend/src/i18n/galleryBehaviorCopy.ts, frontend/src/i18n/galleryCryoCopy.ts, frontend/src/i18n/galleryMixCopy.ts, frontend/src/i18n/homeDetail.ts, …)
* game: —
* backend: 5 файл(ов) (aof_backend/src/lib/chainIndexerCore.ts, aof_backend/src/routes/daily.ts, aof_backend/src/routes/portfolio.ts, aof_backend/src/routes/query.ts, …)
* recipes: —
* assets: frontend/public/assets/icons/data.png, frontend/public/assets/icons/dataset.png, frontend/public/assets/icons/ui/building-data.png, frontend/public/assets/nfts/data-harvester-epic.jpg, frontend/public/assets/nfts/data-harvester-legendary.jpg, frontend/public/assets/nfts/data-harvester-rare.jpg, frontend/public/assets/nfts/data-harvester-uncommon.jpg, frontend/public/assets/nfts/data-harvester.jpg, frontend/public/assets/nfts/resources/data.jpg, frontend/public/assets/nfts/resources/dataset.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/referral.rs#upgrade_handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 3, recipe 6; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Circuit — active-player

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/vrf.ts, aof_backend/src/routes/admin-config.ts)
* recipes: —
* assets: frontend/public/assets/icons/circuit.png, frontend/public/assets/nfts/resources/circuit.jpg
* on-chain source (литерал): aof-core/src/instructions/forge.rs#expire_handler, aof-core/src/instructions/season.rs#claim_reward_handler
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/forge.rs#commit_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/rental_delegation.rs#repair_handler, aof-core/src/instructions/repair.rs#handler, aof-core/src/instructions/start_baking.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler, aof-core/src/instructions/season.rs#claim_reward_handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 5; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Silicon — active-player

* frontend: 11 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/siteToolsCatalog.ts, frontend/src/lib/coreInstructions.ts, …)
* game: —
* backend: 0 файл(ов)
* recipes: —
* assets: frontend/public/assets/icons/silicon.png, frontend/public/assets/icons/ui/building-silicon.png, frontend/public/assets/nfts/resources/silicon.jpg, frontend/public/assets/nfts/silicon-extractor-epic.jpg, frontend/public/assets/nfts/silicon-extractor-legendary.jpg, frontend/public/assets/nfts/silicon-extractor-rare.jpg, frontend/public/assets/nfts/silicon-extractor-uncommon.jpg, frontend/public/assets/nfts/silicon-extractor.jpg
* on-chain source (литерал): aof-core/src/instructions/forge.rs#expire_handler
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/exploration.rs#upgrade_tier_handler, aof-core/src/instructions/forge.rs#commit_handler, aof-core/src/instructions/referral.rs#upgrade_handler, aof-core/src/instructions/rental_delegation.rs#repair_handler, aof-core/src/instructions/repair.rs#handler, aof-core/src/instructions/start_milling.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 4; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Neuron — active-player

* frontend: 9 файл(ов) (frontend/src/components/ToolMiningCard.tsx, frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteToolsCatalog.ts, …)
* game: game/godot/chain/spl_builders.gd, game/godot/products/inventory.gd
* backend: 3 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/lib/toolResourceMint.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neuron.png, frontend/public/assets/nfts/resources/neuron.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/craft_recipe.rs#handler, aof-core/src/instructions/plant_seeds.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_mining.rs#handler, aof-core/src/instructions/rental_delegation.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 5; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Synapse — active-player

* frontend: 15 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteDocs.ts, frontend/src/lib/marketUtils.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/synapse.png, frontend/public/assets/nfts/resources/synapse.jpg
* on-chain source (литерал): aof-core/src/instructions/harvest_wheat.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/start_milling.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/harvest_wheat.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Signal — active-player

* frontend: 10 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteDocs.ts, frontend/src/i18n/siteGuide.ts, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/signal.png, frontend/public/assets/nfts/resources/signal.jpg
* on-chain source (литерал): aof-core/src/instructions/collect_flour.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/start_baking.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_flour.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Model — active-player

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteEconomy.ts, frontend/src/i18n/siteGuide.ts, …)
* game: game/godot/chain/candy_machine.gd
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/model.png, frontend/public/assets/nfts/resources/model.jpg
* on-chain source (литерал): aof-core/src/instructions/collect_bread.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_bread.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Power — active-player

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/wellCopy.ts, frontend/src/lib/craftReadings.ts, …)
* game: —
* backend: 3 файл(ов) (aof_backend/src/lib/economySimulatorV2.ts, aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/power.png, frontend/public/assets/nfts/resources/power.jpg
* on-chain source (литерал): aof-core/src/instructions/collect_well_water.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/start_baking.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/collect_well_water.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Compute — active-internal

* frontend: 5 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/lib/marketUtils.ts, frontend/src/lib/visualAssets.ts, frontend/src/pages/farm/OvenPanel.tsx, …)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/compute.png, frontend/public/assets/nfts/resources/compute.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/start_baking.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

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
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### BlueCore — active-internal

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/blue-core.png, frontend/public/assets/nfts/resources/blue-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 0; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### PurpleCore — active-internal

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/purple-core.png, frontend/public/assets/nfts/resources/purple-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 7; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### RedCore — active-internal

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/red-core.png, frontend/public/assets/nfts/resources/red-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 1; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### ClearQuartz — active-internal

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/clear-quartz.png, frontend/public/assets/nfts/resources/clear-quartz.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 2; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### RoseQuartz — active-internal

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/rose-quartz.png, frontend/public/assets/nfts/resources/rose-quartz.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 6; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### AmberQuartz — candidate-dead

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/amber-quartz.png, frontend/public/assets/nfts/resources/amber-quartz.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=false, has_player_sink=false, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### QuantumBit — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/quantum-bit.png, frontend/public/assets/nfts/resources/quantum-bit.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 3; выход recipe 0
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=true, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### NeuralChip — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/neural-chip.png, frontend/public/assets/nfts/resources/neural-chip.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход recipe 4; выход recipe 1
* флаги: has_player_source=true, has_player_sink=true, tradable=true, craft_input=true, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### PhotonBit — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/photon-bit.png, frontend/public/assets/nfts/resources/photon-bit.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 2
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### BioChip — active-internal

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/bio-chip.png, frontend/public/assets/nfts/resources/bio-chip.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход recipe 7; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=true, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### CryoFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/cryo-fluid.png, frontend/public/assets/nfts/resources/cryo-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 3
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### VoltFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/volt-fluid.png, frontend/public/assets/nfts/resources/volt-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 4
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### BioFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/bio-fluid.png, frontend/public/assets/nfts/resources/bio-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 5
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### NanoFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/nano-fluid.png, frontend/public/assets/nfts/resources/nano-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 6
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### QuantumFluid — active-player

* frontend: 2 файл(ов) (frontend/src/lib/visualAssets.ts, frontend/src/site/content/resources.ts)
* game: —
* backend: 2 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts, aof_backend/src/routes/admin.ts)
* recipes: —
* assets: frontend/public/assets/icons/quantum-fluid.png, frontend/public/assets/nfts/resources/quantum-fluid.jpg
* on-chain source (литерал): aof-core/src/instructions/craft_recipe.rs#handler
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): aof-core/src/instructions/craft_recipe.rs#handler
* проектный сток (VRF/refund): —
* рецепты: вход —; выход recipe 7
* флаги: has_player_source=true, has_player_sink=false, tradable=true, craft_input=false, craft_output=true, admin_mintable=true, player_claimable=true, ui_visible=true

### SoulCore — candidate-dead

* frontend: 1 файл(ов) (frontend/src/site/content/resources.ts)
* game: —
* backend: 1 файл(ов) (aof_backend/src/lib/resourceRegistryCore.ts)
* recipes: —
* assets: frontend/public/assets/nfts/resources/soul-core.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): —
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=false, has_player_sink=false, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

### Mind — active-internal

* frontend: 9 файл(ов) (frontend/src/i18n/homeDetail.ts, frontend/src/i18n/resourceLeads.ts, frontend/src/i18n/siteGlossary.ts, frontend/src/i18n/translations.ts, …)
* game: —
* backend: 1 файл(ов) (aof_backend/src/lib/questGenerator.ts)
* recipes: —
* assets: frontend/public/assets/icons/mind.png, frontend/public/assets/nfts/resources/mind.jpg
* on-chain source (литерал): —
* on-chain sink (литерал): aof-core/src/instructions/craft.rs#handler, aof-core/src/instructions/reroll.rs#handler
* любой kind (generic): aof-core/src/instructions/craft_recipe.rs, aof-core/src/instructions/mint_resource.rs
* путь игрока (источник): —
* проектный сток (VRF/refund): —
* рецепты: вход —; выход —
* флаги: has_player_source=false, has_player_sink=true, tradable=true, craft_input=false, craft_output=false, admin_mintable=true, player_claimable=true, ui_visible=true

