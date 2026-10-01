# План переименования ресурсов (шаг C пункта 12)

Статус: **в работе — канон утверждён, осталось 1354 legacy-идентификаторов в active code** (см. таблицу слоёв).
Документ собирается `node scripts/resource-rename-plan.mjs --write`, гейт — `--check`
(`tests/readiness/resource-rename-plan.test.cjs`). Источники: `docs/RESOURCE_MANIFEST.json`
(канон имён и мест хранения) и `docs/RESOURCE_EVIDENCE.json` (классификация и флаги).

Канонический mapping: **27 ресурсов**, переименованных IDL-вариантов — 27,
переименованных полей минта — 27. Расхождений в манифесте: **0**.

## Слои (порядок работ владельца)

| Слой | Файлов проверено | Остатков | Статус |
|---|---:|---:|---|
| Rust (aof-core/src, programs/*/src) | 134 | 0 | ✅ чисто |
| IDL и TS-типы (aof_backend/src/idl) | 7 | 0 | ✅ чисто |
| Backend (aof_backend/src, aof_backend/scripts) | 168 | 704 | ⚠️ переименовать |
| Frontend (frontend/src) | 268 | 182 | ⚠️ переименовать |
| Game (game/) | 72 | 0 | ✅ чисто |
| Тесты и скрипты (tests, scripts) | 111 | 468 | ⚠️ переименовать |

Остатки в слое «Backend (aof_backend/src, aof_backend/scripts)»: **704** в 38 файле(ах).

| Файл | Найдено | Примеры (строка → токен) |
|---|---:|---|
| `aof_backend/src/routes/admin.ts` | 90 | `139: foodMint`, `140: woodMint`, `141: stoneMint` |
| `aof_backend/src/routes/tools.ts` | 68 | `119: woodBase`, `119: woodMult`, `119: stoneBase` |
| `aof_backend/src/lib/resourceRegistryCore.ts` | 58 | `10: foodMint`, `11: woodMint`, `12: stoneMint` |
| `aof_backend/src/routes/chain.ts` | 55 | `35: seedsMint`, `36: userSeeds`, `36: seedsMint` |
| `aof_backend/src/routes/inbox.ts` | 50 | `73: foodMint`, `74: woodMint`, `75: stoneMint` |
| `aof_backend/scripts/resourceRegistrySelfTest.ts` | 32 | `17: foodMint`, `18: woodMint`, `19: stoneMint` |
| `aof_backend/src/routes/exploration.ts` | 30 | `39: foodMint`, `40: userFood`, `40: foodMint` |
| `aof_backend/src/lib/economyMonitor.ts` | 28 | `11: potatoSupply`, `13: potatoMinted24h`, `42: potatoMint` |
| `aof_backend/src/lib/pda.ts` | 26 | `51: food`, `52: wood`, `53: stone` |
| `aof_backend/scripts/vrfSettlementSelfTest.ts` | 22 | `45: foodMint`, `45: woodMint`, `45: stoneMint` |
| `aof_backend/src/lib/economySimulatorV2.ts` | 22 | `15: water`, `15: "`, `56: potato` |
| `aof_backend/scripts/initMints.ts` | 18 | `138: food`, `138: mints.food`, `138: foodMint` |
| `aof_backend/scripts/initMintsV2.ts` | 18 | `170: food`, `170: mints.food`, `170: foodMint` |
| `aof_backend/src/lib/vrfSettlement.ts` | 18 | `147: woodMint`, `147: userWood`, `148: stoneMint` |
| `aof_backend/src/routes/reroll.ts` | 18 | `62: woodMint`, `63: stoneMint`, `64: foodMint` |
| `aof_backend/src/routes/resources.ts` | 16 | `31: stoneBlue`, `32: stonePurple`, `33: stoneRed` |
| `aof_backend/src/routes/referral.ts` | 15 | `56: woodMint`, `57: stoneMint`, `58: foodMint` |
| `aof_backend/scripts/chainIndexerSelfTest.ts` | 14 | `98: potato`, `99: wood`, `102: wood` |
| `aof_backend/src/lib/economySimulator.ts` | 12 | `39: potato`, `63: potatoSupply`, `94: potato` |
| `aof_backend/src/routes/craftOrder.ts` | 12 | `14: woodNeeded`, `15: stoneNeeded`, `21: woodNeeded` |
| `aof_backend/src/lib/questGenerator.ts` | 11 | `14: potato`, `30: potato`, `39: potato` |
| `aof_backend/src/routes/query.ts` | 10 | `471: foodMint`, `472: woodMint`, `473: stoneMint` |
| `aof_backend/scripts/toolMiningSelfTest.ts` | 9 | `9: foodMint`, `9: woodMint`, `9: stoneMint` |
| `aof_backend/src/lib/toolResourceMint.ts` | 8 | `6: woodMint`, `7: stoneMint`, `8: meat` |
| `aof_backend/src/lib/validation.ts` | 6 | `26: foodMint`, `27: woodMint`, `28: stoneMint` |
| `aof_backend/src/routes/forge.ts` | 6 | `39: woodMint`, `40: userWood`, `40: woodMint` |
| `aof_backend/scripts/potatoDevnetInspectSelfTest.ts` | 5 | `58: food_mint`, `58: wood_mint`, `58: stone_mint` |
| `aof_backend/src/routes/season.ts` | 5 | `118: woodMint`, `124: userWood`, `124: woodMint` |
| `aof_backend/scripts/securityInvariantSelfTest.ts` | 4 | `266: wood_burned`, `266: wood_cost`, `267: stone_burned` |
| `aof_backend/src/lib/dataQuality.ts` | 4 | `5: potatoSupply`, `7: potatoMinted24h`, `15: potatoSupply` |
| `aof_backend/scripts/adminAuthSelfTest.ts` | 3 | `143: potatoMinted24h`, `166: gemBlue`, `171: potato` |
| `aof_backend/scripts/potatoDevnetInspect.ts` | 3 | `47: potatoMint`, `56: cfg.potato_mint`, `57: cfg.potato_mint` |
| `aof_backend/scripts/appendOnlyIntegrationTest.ts` | 2 | `47: potatoSupply`, `47: potatoMinted24h` |
| `aof_backend/src/routes/admin-economy.ts` | 2 | `28: potatoSupply`, `30: potatoMinted24h` |
| `aof_backend/src/lib/cron.ts` | 1 | `17: potatoSupply` |
| `aof_backend/src/routes/friend.ts` | 1 | `8: water` |
| `aof_backend/src/routes/hotMarket.ts` | 1 | `43: potatoMint` |
| `aof_backend/src/routes/liquidity.ts` | 1 | `17: potatoMint` |

Остатки в слое «Frontend (frontend/src)»: **182** в 17 файле(ах).

| Файл | Найдено | Примеры (строка → токен) |
|---|---:|---|
| `frontend/src/pages/farm/OvenPanel.tsx` | 52 | `18: wood`, `18: flour`, `18: bread` |
| `frontend/src/lib/visualAssets.ts` | 24 | `73: food`, `73: wood`, `73: stone` |
| `frontend/src/pages/farm/MillPanel.tsx` | 23 | `18: stone`, `18: wheat`, `18: flour` |
| `frontend/src/pages/farm/PlantingPanel.tsx` | 15 | `19: seedsAmount`, `34: seedsAmount`, `79: seedsMint` |
| `frontend/src/i18n/siteDocs.ts` | 14 | `25: wheat`, `25: flour`, `39: wheat` |
| `frontend/src/pages/tools/RepairPage.tsx` | 14 | `43: wood`, `43: stone`, `61: wood` |
| `frontend/src/site/pages/ExtraSections.tsx` | 8 | `312: potato`, `312: '`, `929: potato` |
| `frontend/src/pages/admin/EconomyDashboard.tsx` | 7 | `14: potatoSupply`, `16: potatoMinted24h`, `155: potatoSupply` |
| `frontend/src/pages/tools/CraftPage.tsx` | 6 | `206: woodMint`, `207: stoneMint`, `208: foodMint` |
| `frontend/src/pages/farm/WellPanel.tsx` | 4 | `46: waterMint`, `97: waterMint`, `100: waterMint` |
| `frontend/src/site/layout/Layout.tsx` | 4 | `42: potato`, `42: '`, `97: potato` |
| `frontend/src/site/content/pages.ts` | 3 | `55: potato`, `73: potato`, `73: '` |
| `frontend/src/i18n/translations.ts` | 2 | `19: potato`, `19: '` |
| `frontend/src/lib/api.ts` | 2 | `17: water`, `225: water` |
| `frontend/src/site/pages/ContentPage.tsx` | 2 | `80: potato`, `80: '` |
| `frontend/src/i18n/apiErrorCopy.ts` | 1 | `120: water` |
| `frontend/src/site/content/scenery.ts` | 1 | `42: potato` |

Остатки в слое «Тесты и скрипты (tests, scripts)»: **468** в 14 файле(ах).

| Файл | Найдено | Примеры (строка → токен) |
|---|---:|---|
| `tests/aof_core.ts` | 271 | `48: foodMint`, `48: woodMint`, `48: stoneMint` |
| `tests/aof_extended.ts` | 106 | `35: foodMint`, `35: woodMint`, `35: stoneMint` |
| `tests/aof_tool_ownership.ts` | 43 | `366: stoneMint`, `367: woodMint`, `370: stone` |
| `scripts/test-devnet-program-probe.py` | 12 | `73: wood`, `73: stone`, `78: wood` |
| `scripts/test-enable-mining-devnet.py` | 12 | `14: woodMint`, `38: woodMint`, `39: stoneMint` |
| `scripts/enable-mining-devnet.sh` | 6 | `101: woodMint`, `102: stoneMint`, `108: meat` |
| `scripts/test-devnet-bringup.py` | 5 | `136: woodMint`, `136: stoneMint`, `136: potatoMint` |
| `scripts/economy/rng-ev.mjs` | 4 | `65: wood`, `65: stone`, `142: wood` |
| `tests/readiness/security-checklist.test.cjs` | 3 | `743: seeds`, `744: seeds`, `751: seeds` |
| `scripts/devnet-program-probe.py` | 2 | `230: wood_mint`, `230: stone_mint` |
| `scripts/build-aof-review.py` | 1 | `30: seeds` |
| `scripts/devnet-bringup.sh` | 1 | `427: potatoMint` |
| `tests/aof_vrf_localnet.ts` | 1 | `230: seeds` |
| `tests/readiness/market-currency-binding.test.cjs` | 1 | `98: potatoMint` |

Правило гейта: остаток — это имя ресурса, использованное как идентификатор ресурса. Имена инструкций
(`plant_seeds`, `harvest_wheat`, `collect_flour`, `collect_bread`, `collect_well_water`, `claim_flour`,
все `potato_*`/`Potato*`) и Anchor-механика `seeds` остатком не считаются: их переименование сдвинуло бы
дискриминаторы инструкций и PDA.

## Порядок работ (шаг C владельца, сверху вниз, один вертикальный срез за раз)

1. **Rust**: поля структур `Config`/`MaterialMints` и `mint_for_kind` — переименование полей
   (байтовый layout не меняется, порядок не меняется);
2. **таблицы программы**: `expected_resource_mint` в ордербуке, `resource_kind_for_tool` в майнинге,
   рецепты `craft_recipe.rs`, аргументы `init_material_mints`;
3. **seeds/константы/события/ошибки**: только если строка содержит farming-имя; варианты enum не
   переставлять, ошибки не сдвигать;
4. **backend**: карты kind (`resourceRegistryCore.ts`, `routes/*.ts`) и любые `cfg.foodMint`-подобные
   обращения — на канонические (`cfg.dataMint`);
5. **frontend**: каталоги, i18n, интенты, ключи API;
6. **game**: каталоги Godot-клиента;
7. **скрипты/тесты**: гейты, фикстуры, ожидания;
8. **IDL**: перегенерация из Rust (`python3 scripts/idl-from-source.py aof_core --instructions … --types …`,
   затем `python3 scripts/idl-sync-ts.py`, `python3 scripts/check-idl-drift.py`);
9. **docs**: `docs/RESOURCE_MANIFEST.md`, этот файл, `docs/RESOURCE_EVIDENCE.md`.

Правила: **без алиасов и совместимости** (`food_mint → data_mint`, `wood_mint → circuit_mint`,
`stone_mint → silicon_mint` — прямо), варианты enum не переставлять, layout-report обязателен только
если поле удаляется или меняет порядок (в этом плане таких изменений нет).

## Полная таблица соответствий (27 строк)

Ни один идентификатор не остаётся алиасом: старые имена удаляются из active code целиком.
`Old Rust/IDL/backend name` перечисляет все старые написания ресурса, которые существовали в коде
(поле структуры, вариант IDL, ключи backend-карт). Тип поля и порядок берутся из `state.rs`;
переименование поля не меняет ни тип, ни место в структуре, ни дискриминанты enum.

| Index | Old Rust/IDL/backend name | Canonical ResourceKind | Field type | Order unchanged |
|---:|---|---|---|---:|
| 0 | `food_mint`, `Food`, `food` | Data (`config.data_mint`) | Pubkey | yes (rename only) |
| 1 | `wood_mint`, `Wood`, `wood` | Circuit (`config.circuit_mint`) | Pubkey | yes (rename only) |
| 2 | `stone_mint`, `Stone`, `stone` | Silicon (`config.silicon_mint`) | Pubkey | yes (rename only) |
| 3 | `seeds`, `Seeds` | Neuron (`material_mints.neuron`) | Pubkey | yes (rename only) |
| 4 | `wheat`, `Wheat` | Synapse (`material_mints.synapse`) | Pubkey | yes (rename only) |
| 5 | `flour`, `Flour` | Signal (`material_mints.signal`) | Pubkey | yes (rename only) |
| 6 | `bread`, `Bread` | Model (`material_mints.model`) | Pubkey | yes (rename only) |
| 7 | `water`, `Water` | Power (`material_mints.power`) | Pubkey | yes (rename only) |
| 8 | `coal`, `Coal` | Compute (`material_mints.compute`) | Pubkey | yes (rename only) |
| 9 | `meat`, `Meat` | Dataset (`material_mints.dataset`) | Pubkey | yes (rename only) |
| 10 | `stone_blue`, `StoneBlue`, `stoneBlue` | BlueCore (`material_mints.blue_core`) | Pubkey | yes (rename only) |
| 11 | `stone_purple`, `StonePurple`, `stonePurple` | PurpleCore (`material_mints.purple_core`) | Pubkey | yes (rename only) |
| 12 | `stone_red`, `StoneRed`, `stoneRed` | RedCore (`material_mints.red_core`) | Pubkey | yes (rename only) |
| 13 | `sand_white`, `SandWhite`, `sandWhite` | ClearQuartz (`material_mints.clear_quartz`) | Pubkey | yes (rename only) |
| 14 | `sand_pink`, `SandPink`, `sandPink` | RoseQuartz (`material_mints.rose_quartz`) | Pubkey | yes (rename only) |
| 15 | `sand_yellow`, `SandYellow`, `sandYellow` | AmberQuartz (`material_mints.amber_quartz`) | Pubkey | yes (rename only) |
| 16 | `gem_blue`, `GemBlue`, `gemBlue` | QuantumBit (`material_mints.quantum_bit`) | Pubkey | yes (rename only) |
| 17 | `gem_orange`, `GemOrange`, `gemOrange` | NeuralChip (`material_mints.neural_chip`) | Pubkey | yes (rename only) |
| 18 | `gem_white`, `GemWhite`, `gemWhite` | PhotonBit (`material_mints.photon_bit`) | Pubkey | yes (rename only) |
| 19 | `gem_green`, `GemGreen`, `gemGreen` | BioChip (`material_mints.bio_chip`) | Pubkey | yes (rename only) |
| 20 | `flask_blue`, `FlaskBlue`, `flaskBlue` | CryoFluid (`material_mints.cryo_fluid`) | Pubkey | yes (rename only) |
| 21 | `flask_yellow`, `FlaskYellow`, `flaskYellow` | VoltFluid (`material_mints.volt_fluid`) | Pubkey | yes (rename only) |
| 22 | `flask_green`, `FlaskGreen`, `flaskGreen` | BioFluid (`material_mints.bio_fluid`) | Pubkey | yes (rename only) |
| 23 | `flask_pink`, `FlaskPink`, `flaskPink` | NanoFluid (`material_mints.nano_fluid`) | Pubkey | yes (rename only) |
| 24 | `flask_purple`, `FlaskPurple`, `flaskPurple` | QuantumFluid (`material_mints.quantum_fluid`) | Pubkey | yes (rename only) |
| 25 | `love_heart`, `LoveHeart`, `loveHeart` | SoulCore (`material_mints.soul_core`) | Pubkey | yes (rename only) |
| 26 | `potato_mint`, `Potato`, `potato` | Mind (`config.mind_mint`) | Pubkey | yes (rename only) |

Минт-поля: было → стало (27):

* `config.food_mint` → `config.data_mint` (Data)
* `config.wood_mint` → `config.circuit_mint` (Circuit)
* `config.stone_mint` → `config.silicon_mint` (Silicon)
* `material_mints.seeds` → `material_mints.neuron` (Neuron)
* `material_mints.wheat` → `material_mints.synapse` (Synapse)
* `material_mints.flour` → `material_mints.signal` (Signal)
* `material_mints.bread` → `material_mints.model` (Model)
* `material_mints.water` → `material_mints.power` (Power)
* `material_mints.coal` → `material_mints.compute` (Compute)
* `material_mints.meat` → `material_mints.dataset` (Dataset)
* `material_mints.stone_blue` → `material_mints.blue_core` (BlueCore)
* `material_mints.stone_purple` → `material_mints.purple_core` (PurpleCore)
* `material_mints.stone_red` → `material_mints.red_core` (RedCore)
* `material_mints.sand_white` → `material_mints.clear_quartz` (ClearQuartz)
* `material_mints.sand_pink` → `material_mints.rose_quartz` (RoseQuartz)
* `material_mints.sand_yellow` → `material_mints.amber_quartz` (AmberQuartz)
* `material_mints.gem_blue` → `material_mints.quantum_bit` (QuantumBit)
* `material_mints.gem_orange` → `material_mints.neural_chip` (NeuralChip)
* `material_mints.gem_white` → `material_mints.photon_bit` (PhotonBit)
* `material_mints.gem_green` → `material_mints.bio_chip` (BioChip)
* `material_mints.flask_blue` → `material_mints.cryo_fluid` (CryoFluid)
* `material_mints.flask_yellow` → `material_mints.volt_fluid` (VoltFluid)
* `material_mints.flask_green` → `material_mints.bio_fluid` (BioFluid)
* `material_mints.flask_pink` → `material_mints.nano_fluid` (NanoFluid)
* `material_mints.flask_purple` → `material_mints.quantum_fluid` (QuantumFluid)
* `material_mints.love_heart` → `material_mints.soul_core` (SoulCore)
* `config.potato_mint` → `config.mind_mint` (Mind)

## Файлы, которые описывают legacy-имена (исключены из скана)

Это не использование ресурсных идентификаторов, а их описание: mapping-таблицы, alias-списки
для запрета в player-facing тексте и негативные фикстуры гейта. Ни один файл отсюда не является
runtime-кодом продукта — это проверяется тем же гейтом.

| Файл | Почему исключён |
|---|---|
| `scripts/rebrand.mjs` | таблица mapping «старое → новое» — это предмет файла |
| `scripts/resource-manifest.mjs` | список farming-алиасов, запрещённых в player-facing `display` |
| `scripts/resource-usage.mjs` | список алиасов для evidence-скана (кто где встречается) |
| `scripts/resource-rename-plan.mjs` | KEEP-список, формы legacy и этот перечень — правила гейта |
| `scripts/idl-from-source.py` | Anchor PDA `seeds` в генераторе IDL — не ресурс Neuron |
| `tests/readiness/resource-rename-plan.test.cjs` | негативные фикстуры: остаток обязан ронять гейт |
| `tests/readiness/resource-manifest.test.cjs` | негативные фикстуры алиасов в `display` |

## Что запрещено в этом плане

* оставлять алиасы или читать оба имени «на время перехода»;
* переставлять варианты `ResourceKind` или сдвигать коды ошибок;
* удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind и связанные mint-поля/капы до отдельного
  решения владельца;
* трогать семь отключённых инструкций из `docs/DEAD_CODE_EVIDENCE.md`;
* переименовывать имена инструкций (`plant_seeds`, `harvest_wheat`, `collect_flour`, `collect_bread`,
  `collect_well_water`, `claim_flour`, `potato_*`) — это сдвинуло бы дискриминаторы;
* смешивать переименование с изменением экономики (формулы, капы, награды).

## Классификация на момент утверждения

* active-player (25): Data, Circuit, Silicon, Neuron, Synapse, Signal, Model, Power, Compute, Dataset, BlueCore, PurpleCore, RedCore, ClearQuartz, RoseQuartz, QuantumBit, NeuralChip, PhotonBit, BioChip, CryoFluid, VoltFluid, BioFluid, NanoFluid, QuantumFluid, Mind;
* active-internal (0): —;
* candidate-dead (2): AmberQuartz, SoulCore.

Статусы выведены из кода (`docs/RESOURCE_EVIDENCE.md`), а не назначены руками; удаление кандидатов
делается отдельным шагом после утверждения, не вместе с переименованием.

## Проверка после переименования

```bash
node scripts/resource-manifest.mjs --write && node scripts/resource-manifest.mjs --check  # drift 43 → 0
python3 scripts/idl-from-source.py aof_core --instructions "$(…)" --types "$(…)"
python3 scripts/idl-sync-ts.py && python3 scripts/check-idl-drift.py
python3 scripts/gen-core-instruction-table.py --check
node scripts/resource-rename-plan.mjs --check   # legacy-идентификаторов в active code — 0
node scripts/resource-usage.mjs --check
node --test tests/readiness/*.test.cjs
```

Готовность шага C: `drift` в манифесте пуст, в active-коде нет farming-идентификаторов,
`unclassified` в инвентаре инструкций — 0, readiness зелёный, затем `anchor build` +
`git diff -- idls/` на машине с тулчейном.

