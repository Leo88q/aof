# Канонический манифест ресурсов

Источник истины для имён ресурсов: Rust `ResourceKind` ↔ IDL/клиенты ↔ место хранения минта
↔ farming-алиасы. Создаётся `node scripts/resource-manifest.mjs --write`, гейт — `--check`
(плюс `tests/readiness/resource-manifest.test.cjs`).

Правило: **player-facing имя — только NeuroForge-канон (`display`); в active code farming-имён нет
(`legacyAliases`/`historicalField` — только историческая справка для mapping шага C).** Гейт не пропускает
farming-алиас в `display`, а `scripts/resource-rename-plan.mjs --check` — в active code.

Ресурсов: **27**; расхождений кода с каноном (долг до переименования): **0**.
Переименовано полей минта (историческое имя → канон): **27**.

| # | kind (Rust/IDL-канон) | apiName | Где минт сейчас | поле минта: было → стало | farming-алиасы (исторические) | display | IDL-имя |
|---|---|---|---|---|---|---|---|
| 0 | Data | `data` | `config.data_mint` | `food_mint` → `data_mint` | `food` | Data | `Food` → `Data` |
| 1 | Circuit | `circuit` | `config.circuit_mint` | `wood_mint` → `circuit_mint` | `wood` | Circuit | `Wood` → `Circuit` |
| 2 | Silicon | `silicon` | `config.silicon_mint` | `stone_mint` → `silicon_mint` | `stone` | Silicon | `Stone` → `Silicon` |
| 3 | Neuron | `neuron` | `material_mints.neuron` | `seeds` → `neuron` | `seeds` | Neuron | `Seeds` → `Neuron` |
| 4 | Synapse | `synapse` | `material_mints.synapse` | `wheat` → `synapse` | `wheat` | Synapse | `Wheat` → `Synapse` |
| 5 | Signal | `signal` | `material_mints.signal` | `flour` → `signal` | `flour` | Signal | `Flour` → `Signal` |
| 6 | Model | `model` | `material_mints.model` | `bread` → `model` | `bread` | Model | `Bread` → `Model` |
| 7 | Power | `power` | `material_mints.power` | `water` → `power` | `water` | Power | `Water` → `Power` |
| 8 | Compute | `compute` | `material_mints.compute` | `coal` → `compute` | `coal` | Compute | `Coal` → `Compute` |
| 9 | Dataset | `dataset` | `material_mints.dataset` | `meat` → `dataset` | `meat` | Dataset | `Meat` → `Dataset` |
| 10 | BlueCore | `blueCore` | `material_mints.blue_core` | `stone_blue` → `blue_core` | `stone_blue`, `stoneBlue` | Blue Core | `StoneBlue` → `BlueCore` |
| 11 | PurpleCore | `purpleCore` | `material_mints.purple_core` | `stone_purple` → `purple_core` | `stone_purple`, `stonePurple` | Purple Core | `StonePurple` → `PurpleCore` |
| 12 | RedCore | `redCore` | `material_mints.red_core` | `stone_red` → `red_core` | `stone_red`, `stoneRed` | Red Core | `StoneRed` → `RedCore` |
| 13 | ClearQuartz | `clearQuartz` | `material_mints.clear_quartz` | `sand_white` → `clear_quartz` | `sand_white`, `sandWhite` | Clear Quartz | `SandWhite` → `ClearQuartz` |
| 14 | RoseQuartz | `roseQuartz` | `material_mints.rose_quartz` | `sand_pink` → `rose_quartz` | `sand_pink`, `sandPink` | Rose Quartz | `SandPink` → `RoseQuartz` |
| 15 | AmberQuartz | `amberQuartz` | `material_mints.amber_quartz` | `sand_yellow` → `amber_quartz` | `sand_yellow`, `sandYellow` | Amber Quartz | `SandYellow` → `AmberQuartz` |
| 16 | QuantumBit | `quantumBit` | `material_mints.quantum_bit` | `gem_blue` → `quantum_bit` | `gem_blue`, `gemBlue` | Quantum Bit | `GemBlue` → `QuantumBit` |
| 17 | NeuralChip | `neuralChip` | `material_mints.neural_chip` | `gem_orange` → `neural_chip` | `gem_orange`, `gemOrange` | Neural Chip | `GemOrange` → `NeuralChip` |
| 18 | PhotonBit | `photonBit` | `material_mints.photon_bit` | `gem_white` → `photon_bit` | `gem_white`, `gemWhite` | Photon Bit | `GemWhite` → `PhotonBit` |
| 19 | BioChip | `bioChip` | `material_mints.bio_chip` | `gem_green` → `bio_chip` | `gem_green`, `gemGreen` | Bio Chip | `GemGreen` → `BioChip` |
| 20 | CryoFluid | `cryoFluid` | `material_mints.cryo_fluid` | `flask_blue` → `cryo_fluid` | `flask_blue`, `flaskBlue` | Cryo Fluid | `FlaskBlue` → `CryoFluid` |
| 21 | VoltFluid | `voltFluid` | `material_mints.volt_fluid` | `flask_yellow` → `volt_fluid` | `flask_yellow`, `flaskYellow` | Volt Fluid | `FlaskYellow` → `VoltFluid` |
| 22 | BioFluid | `bioFluid` | `material_mints.bio_fluid` | `flask_green` → `bio_fluid` | `flask_green`, `flaskGreen` | Bio Fluid | `FlaskGreen` → `BioFluid` |
| 23 | NanoFluid | `nanoFluid` | `material_mints.nano_fluid` | `flask_pink` → `nano_fluid` | `flask_pink`, `flaskPink` | Nano Fluid | `FlaskPink` → `NanoFluid` |
| 24 | QuantumFluid | `quantumFluid` | `material_mints.quantum_fluid` | `flask_purple` → `quantum_fluid` | `flask_purple`, `flaskPurple` | Quantum Fluid | `FlaskPurple` → `QuantumFluid` |
| 25 | SoulCore | `soulCore` | `material_mints.soul_core` | `love_heart` → `soul_core` | `love_heart`, `loveHeart` | Soul Core | `LoveHeart` → `SoulCore` |
| 26 | Mind | `mind` | `config.mind_mint` | `potato_mint` → `mind_mint` | `potato` | Mind | `Potato` → `Mind` |

## Долг до переименования (пункт 12)

Расхождений нет: Rust, IDL и backend-карты используют канонические имена.

## Player-facing имена

`display` — канонические англоязычные названия продукта; русские глоссы (Данные, Контур, Кремний,
Нейрон, Синапс, Сигнал, Модель, Энергия, Вычисления, Датасет, ядра, кварцы, биты/чипы, флюиды,
Ядро души, Разум) используются в UI. Ни одно из них не содержит farming-слов — это проверяет гейт.
