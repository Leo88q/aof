# Экономические разрывы ресурсов (pre-deployment product blockers)

Отчёт собирается `node scripts/resource-economy-gaps.mjs --write` и проверяется `--check`
(`tests/readiness/resource-economy-gaps.test.cjs`). Источник — `docs/RESOURCE_EVIDENCE.json`;
ручных списков разрывов нет.

**Статус ресурса и экономическая связность — разные оси.** Ресурс остаётся `active-player`,
если он бывает балансом игрока (в ATA игрока, сжигается из него, вход/выход рецепта), даже
если источника у него сейчас нет. `economy_issue` (`missing_source`/`missing_sink`) — это
дефект экономики, а не повод называть ресурс internal или мёртвым.

**Разрывы не блокируют чистое переименование identifiers** (пункты 5 и 8 решения владельца):
переименование не меняет ни рецепты, ни источники, ни стоки. Они остаются pre-deployment
product blockers до отдельного решения владельца об экономике.

* без доказанного player source (0): —;
* без стока (0): —.

## Таблица по ресурсам

| Resource | Player-held | Sources | Sinks | Recipes | Generic paths | Gap |
|---|---:|---|---|---|---|---|
| Data | ✅ | craft_recipe.rs#handler, recipe 8 (выход) | craft.rs#handler, craft_recipe.rs#handler, exchange_data_energy.rs#handler, exploration.rs#upgrade_tier_handler, recipe 3 (вход), recipe 6 (вход), referral.rs#upgrade_handler | recipe 3: вход, recipe 6: вход, recipe 8: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Circuit | ✅ | collect_mining.rs#handler, rental_delegation.rs#handler, season.rs#claim_premium_reward_handler | craft.rs#handler, craft_recipe.rs#handler, exploration.rs#upgrade_tier_handler, recipe 12 (вход), recipe 14 (вход), recipe 17 (вход), recipe 5 (вход), recipe 9 (вход), referral.rs#upgrade_handler, rental_delegation.rs#repair_handler, repair.rs#handler, start_model_training.rs#handler | recipe 12: вход, recipe 14: вход, recipe 17: вход, recipe 5: вход, recipe 9: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Silicon | ✅ | collect_mining.rs#handler, rental_delegation.rs#handler | craft.rs#handler, craft_recipe.rs#handler, exploration.rs#upgrade_tier_handler, recipe 10 (вход), recipe 4 (вход), referral.rs#upgrade_handler, rental_delegation.rs#repair_handler, repair.rs#handler, start_signal_processing.rs#handler | recipe 10: вход, recipe 4: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Neuron | ✅ | collect_mining.rs#handler, rental_delegation.rs#handler | craft.rs#handler, craft_recipe.rs#handler, plant_neuron.rs#handler, recipe 11 (вход), recipe 13 (вход), recipe 14 (вход), recipe 5 (вход) | recipe 11: вход, recipe 13: вход, recipe 14: вход, recipe 5: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Synapse | ✅ | harvest_synapse.rs#handler | start_signal_processing.rs#handler | — | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Signal | ✅ | collect_signal.rs#handler | start_model_training.rs#handler | — | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Model | ✅ | collect_model.rs#handler | seal_laboratory.rs#handler | — | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Power | ✅ | collect_power.rs#handler | craft.rs#handler, start_model_training.rs#handler | — | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Compute | ✅ | craft_recipe.rs#handler, recipe 17 (выход) | start_model_training.rs#handler | recipe 17: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Dataset | ✅ | collect_mining.rs#handler, rental_delegation.rs#handler | craft_recipe.rs#handler, recipe 12 (вход), recipe 13 (вход), recipe 16 (вход), recipe 17 (вход), recipe 8 (вход) | recipe 12: вход, recipe 13: вход, recipe 16: вход, recipe 17: вход, recipe 8: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| BlueCore | ✅ | craft_recipe.rs#handler, recipe 9 (выход) | craft_recipe.rs#handler, recipe 0 (вход) | recipe 0: вход, recipe 9: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| PurpleCore | ✅ | craft_recipe.rs#handler, recipe 11 (выход) | craft_recipe.rs#handler, recipe 7 (вход) | recipe 11: выход, recipe 7: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| RedCore | ✅ | craft_recipe.rs#handler, recipe 10 (выход) | craft_recipe.rs#handler, recipe 1 (вход) | recipe 10: выход, recipe 1: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| ClearQuartz | ✅ | craft_recipe.rs#handler, recipe 12 (выход) | craft_recipe.rs#handler, recipe 2 (вход) | recipe 12: выход, recipe 2: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| RoseQuartz | ✅ | craft_recipe.rs#handler, recipe 13 (выход) | craft_recipe.rs#handler, recipe 6 (вход) | recipe 13: выход, recipe 6: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| AmberQuartz | ✅ | craft_recipe.rs#handler, recipe 15 (выход) | seal_laboratory.rs#handler | recipe 15: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| QuantumBit | ✅ | craft_recipe.rs#handler, recipe 0 (выход) | craft_recipe.rs#handler, recipe 3 (вход) | recipe 0: выход, recipe 3: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| NeuralChip | ✅ | craft_recipe.rs#handler, recipe 1 (выход) | craft_recipe.rs#handler, recipe 4 (вход) | recipe 1: выход, recipe 4: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| PhotonBit | ✅ | craft_recipe.rs#handler, recipe 2 (выход) | craft_recipe.rs#handler, recipe 15 (вход) | recipe 15: вход, recipe 2: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| BioChip | ✅ | craft_recipe.rs#handler, recipe 14 (выход) | craft_recipe.rs#handler, recipe 7 (вход) | recipe 14: выход, recipe 7: вход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| CryoFluid | ✅ | craft_recipe.rs#handler, recipe 3 (выход) | seal_laboratory.rs#handler | recipe 3: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| VoltFluid | ✅ | craft_recipe.rs#handler, recipe 4 (выход) | seal_laboratory.rs#handler | recipe 4: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| BioFluid | ✅ | craft_recipe.rs#handler, recipe 5 (выход) | seal_laboratory.rs#handler | recipe 5: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| NanoFluid | ✅ | craft_recipe.rs#handler, recipe 6 (выход) | seal_laboratory.rs#handler | recipe 6: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| QuantumFluid | ✅ | craft_recipe.rs#handler, recipe 7 (выход) | seal_laboratory.rs#handler | recipe 7: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| SoulCore | ✅ | seal_laboratory.rs#handler | seal_laboratory.rs#handler | — | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |
| Mind | ✅ | craft_recipe.rs#handler, recipe 16 (выход) | craft.rs#handler, reroll.rs#handler | recipe 16: выход | admin: admin_config.rs, burn_resource.rs, issuance_cap.rs, lib.rs, mint_resource.rs; claim: lib.rs, mint_resource_once.rs | — |

## Блокеры деплоя

### missing_source (0)


### missing_sink (0)


Изменение рецептов, источников и стоков — только по отдельному решению владельца (п. 8).
