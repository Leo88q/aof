# Канонический манифест ресурсов

Источник истины для имён ресурсов: Rust `ResourceKind` ↔ IDL/клиенты ↔ место хранения минта
↔ farming-алиасы. Создаётся `node scripts/resource-manifest.mjs --write`, гейт — `--check`
(плюс `tests/readiness/resource-manifest.test.cjs`).

Правило: **player-facing имя — только NeuroForge-канон (`display`); farming-имена живут лишь как
`legacyAliases`/`legacyField` и удаляются из active code в пункте 12 плана.** Гейт не пропускает
farming-алиас в `display`.

Ресурсов: **27**; расхождений кода с каноном (долг до переименования): **43**.

| # | kind (Rust/IDL-канон) | apiName | Где минт сейчас | legacy-поле | farming-алиасы | display | IDL-имя |
|---|---|---|---|---|---|---|---|
| 0 | Data | `data` | `config.food_mint` | `food_mint` | `food` | Data | ⚠️ pending |
| 1 | Circuit | `circuit` | `config.wood_mint` | `wood_mint` | `wood` | Circuit | ⚠️ pending |
| 2 | Silicon | `silicon` | `config.stone_mint` | `stone_mint` | `stone` | Silicon | ⚠️ pending |
| 3 | Neuron | `neuron` | `material_mints.seeds` | `seeds` | `seeds` | Neuron | ⚠️ pending |
| 4 | Synapse | `synapse` | `material_mints.wheat` | `wheat` | `wheat` | Synapse | ⚠️ pending |
| 5 | Signal | `signal` | `material_mints.flour` | `flour` | `flour` | Signal | ⚠️ pending |
| 6 | Model | `model` | `material_mints.bread` | `bread` | `bread` | Model | ⚠️ pending |
| 7 | Power | `power` | `material_mints.water` | `water` | `water` | Power | ⚠️ pending |
| 8 | Compute | `compute` | `material_mints.coal` | `coal` | `coal` | Compute | ⚠️ pending |
| 9 | Dataset | `dataset` | `material_mints.meat` | `meat` | `meat` | Dataset | ⚠️ pending |
| 10 | BlueCore | `blueCore` | `material_mints.stone_blue` | `stone_blue` | `stone_blue`, `stoneBlue` | Blue Core | ⚠️ pending |
| 11 | PurpleCore | `purpleCore` | `material_mints.stone_purple` | `stone_purple` | `stone_purple`, `stonePurple` | Purple Core | ⚠️ pending |
| 12 | RedCore | `redCore` | `material_mints.stone_red` | `stone_red` | `stone_red`, `stoneRed` | Red Core | ⚠️ pending |
| 13 | ClearQuartz | `clearQuartz` | `material_mints.sand_white` | `sand_white` | `sand_white`, `sandWhite` | Clear Quartz | ⚠️ pending |
| 14 | RoseQuartz | `roseQuartz` | `material_mints.sand_pink` | `sand_pink` | `sand_pink`, `sandPink` | Rose Quartz | ⚠️ pending |
| 15 | AmberQuartz | `amberQuartz` | `material_mints.sand_yellow` | `sand_yellow` | `sand_yellow`, `sandYellow` | Amber Quartz | ⚠️ pending |
| 16 | QuantumBit | `quantumBit` | `material_mints.gem_blue` | `gem_blue` | `gem_blue`, `gemBlue` | Quantum Bit | ⚠️ pending |
| 17 | NeuralChip | `neuralChip` | `material_mints.gem_orange` | `gem_orange` | `gem_orange`, `gemOrange` | Neural Chip | ⚠️ pending |
| 18 | PhotonBit | `photonBit` | `material_mints.gem_white` | `gem_white` | `gem_white`, `gemWhite` | Photon Bit | ⚠️ pending |
| 19 | BioChip | `bioChip` | `material_mints.gem_green` | `gem_green` | `gem_green`, `gemGreen` | Bio Chip | ⚠️ pending |
| 20 | CryoFluid | `cryoFluid` | `material_mints.flask_blue` | `flask_blue` | `flask_blue`, `flaskBlue` | Cryo Fluid | ⚠️ pending |
| 21 | VoltFluid | `voltFluid` | `material_mints.flask_yellow` | `flask_yellow` | `flask_yellow`, `flaskYellow` | Volt Fluid | ⚠️ pending |
| 22 | BioFluid | `bioFluid` | `material_mints.flask_green` | `flask_green` | `flask_green`, `flaskGreen` | Bio Fluid | ⚠️ pending |
| 23 | NanoFluid | `nanoFluid` | `material_mints.flask_pink` | `flask_pink` | `flask_pink`, `flaskPink` | Nano Fluid | ⚠️ pending |
| 24 | QuantumFluid | `quantumFluid` | `material_mints.flask_purple` | `flask_purple` | `flask_purple`, `flaskPurple` | Quantum Fluid | ⚠️ pending |
| 25 | SoulCore | `soulCore` | `material_mints.love_heart` | `love_heart` | `love_heart`, `loveHeart` | Soul Core | ⚠️ pending |
| 26 | Mind | `mind` | `config.potato_mint` | `potato_mint` | `potato` | Mind | ⚠️ pending |

## Долг до переименования (пункт 12)

### Farming-имена в backend-картах (16)

Значения IDL-аргумента собираются из этих ключей; после переименования IDL ключи обязаны стать каноническими.

| Файл | kind | legacy-ключ |
|---|---|---|
| aof_backend/src/routes/resources.ts | AmberQuartz | `sandYellow` |
| aof_backend/src/routes/resources.ts | BioChip | `gemGreen` |
| aof_backend/src/routes/resources.ts | BioFluid | `flaskGreen` |
| aof_backend/src/routes/resources.ts | BlueCore | `stoneBlue` |
| aof_backend/src/routes/resources.ts | ClearQuartz | `sandWhite` |
| aof_backend/src/routes/resources.ts | CryoFluid | `flaskBlue` |
| aof_backend/src/routes/resources.ts | NanoFluid | `flaskPink` |
| aof_backend/src/routes/resources.ts | NeuralChip | `gemOrange` |
| aof_backend/src/routes/resources.ts | PhotonBit | `gemWhite` |
| aof_backend/src/routes/resources.ts | PurpleCore | `stonePurple` |
| aof_backend/src/routes/resources.ts | QuantumBit | `gemBlue` |
| aof_backend/src/routes/resources.ts | QuantumFluid | `flaskPurple` |
| aof_backend/src/routes/resources.ts | RedCore | `stoneRed` |
| aof_backend/src/routes/resources.ts | RoseQuartz | `sandPink` |
| aof_backend/src/routes/resources.ts | SoulCore | `loveHeart` |
| aof_backend/src/routes/resources.ts | VoltFluid | `flaskYellow` |

### IDL-имена вариантов ResourceKind (27)

IDL всё ещё публикует farming-имена. Починка: `python3 scripts/idl-from-source.py aof_core --types ResourceKind`
затем `python3 scripts/idl-sync-ts.py` и `python3 scripts/check-idl-drift.py`.

| kind | в Rust | в IDL |
|---|---|---|
| Data | Data | Food |
| Circuit | Circuit | Wood |
| BlueCore | BlueCore | StoneBlue |
| PurpleCore | PurpleCore | StonePurple |
| RedCore | RedCore | StoneRed |
| ClearQuartz | ClearQuartz | SandWhite |
| RoseQuartz | RoseQuartz | SandPink |
| AmberQuartz | AmberQuartz | SandYellow |
| QuantumBit | QuantumBit | GemBlue |
| NeuralChip | NeuralChip | GemOrange |
| PhotonBit | PhotonBit | GemWhite |
| BioChip | BioChip | GemGreen |
| Silicon | Silicon | Stone |
| CryoFluid | CryoFluid | FlaskBlue |
| VoltFluid | VoltFluid | FlaskYellow |
| BioFluid | BioFluid | FlaskGreen |
| NanoFluid | NanoFluid | FlaskPink |
| QuantumFluid | QuantumFluid | FlaskPurple |
| SoulCore | SoulCore | LoveHeart |
| Mind | Mind | Potato |
| Neuron | Neuron | Seeds |
| Synapse | Synapse | Wheat |
| Signal | Signal | Flour |
| Model | Model | Bread |
| Power | Power | Water |
| Compute | Compute | Coal |
| Dataset | Dataset | Meat |

## Player-facing имена

`display` — канонические англоязычные названия продукта; русские глоссы (Данные, Контур, Кремний,
Нейрон, Синапс, Сигнал, Модель, Энергия, Вычисления, Датасет, ядра, кварцы, биты/чипы, флюиды,
Ядро души, Разум) используются в UI. Ни одно из них не содержит farming-слов — это проверяет гейт.

