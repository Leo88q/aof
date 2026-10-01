# План переименования ресурсов (шаг C пункта 12)

Статус: **не начато — требуется утверждение владельцем канонического mapping**.
Документ собирается `node scripts/resource-rename-plan.mjs --write`, гейт — `--check`
(`tests/readiness/resource-rename-plan.test.cjs`). Источники: `docs/RESOURCE_MANIFEST.json`
(канон имён и мест хранения) и `docs/RESOURCE_EVIDENCE.json` (классификация и флаги).

Долг, который план закрывает: **43** расхождений — 27 IDL-вариантов
и 16 legacy-ключей backend-карт (в 1 файле(ах)).

## Порядок работ (шаг C владельца, сверху вниз, один вертикальный срез за раз)

1. **Rust**: поля структур `Config`/`MaterialMints` и `mint_for_kind` — переименование полей
   (байтовый layout не меняется, порядок не меняется);
2. **таблицы программы**: `expected_resource_mint` в ордербуке, `resource_kind_for_tool` в майнинге,
   рецепты `craft_recipe.rs`, аргументы `init_material_mints`;
3. **seeds/константы/события/ошибки**: только если строка содержит farming-имя; варианты enum не
   переставлять, ошибки не сдвигать;
4. **backend**: карты kind (`routes/resources.ts` и др.) и любые `cfg.foodMint`-подобные обращения —
   на канонические (`cfg.dataMint`);
5. **frontend**: каталоги, i18n, интенты, ключи API;
6. **game**: каталоги Godot-клиента;
7. **скрипты/тесты**: гейты, фикстуры, ожидания;
8. **IDL**: перегенерация из Rust (`python3 scripts/idl-from-source.py aof_core --types ResourceKind`,
   затем `python3 scripts/idl-sync-ts.py`, `python3 scripts/check-idl-drift.py`);
9. **docs**: `docs/RESOURCE_MANIFEST.md`, этот файл, `docs/RESOURCE_EVIDENCE.md`.

Правила: **без алиасов и совместимости** (`food_mint → data_mint`, `wood_mint → circuit_mint`,
`stone_mint → silicon_mint` — прямо), варианты enum не переставлять, layout-report обязателен только
если поле удаляется или меняет порядок (в этом плане таких изменений нет).

## Полная таблица соответствий (27 строк)

Ни один идентификатор не остаётся алиасом: старые имена удаляются из active code целиком.
`Old Rust/IDL/backend name` перечисляет все старые написания ресурса, которые существуют в коде
(поле структуры, вариант IDL, ключи backend-карт). Тип поля и порядок берутся из `state.rs`;
переименование поля не меняет ни тип, ни место в структуре, ни дискриминанты enum.

| Index | Old Rust/IDL/backend name | Canonical ResourceKind | Field type | Order unchanged |
|---:|---|---|---|---:|
| 0 | `food_mint`, `Food` | Data (`config.data_mint`) | Pubkey | yes (rename only) |
| 1 | `wood_mint`, `Wood` | Circuit (`config.circuit_mint`) | Pubkey | yes (rename only) |
| 2 | `stone_mint`, `Stone` | Silicon (`config.silicon_mint`) | Pubkey | yes (rename only) |
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
| 26 | `potato_mint`, `Potato` | Mind (`config.mind_mint`) | Pubkey | yes (rename only) |

Минт-поля к переименованию (27):

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

Legacy-ключи backend-карт (16):

* `stoneBlue` → `blueCore` (BlueCore, aof_backend/src/routes/resources.ts)
* `stonePurple` → `purpleCore` (PurpleCore, aof_backend/src/routes/resources.ts)
* `stoneRed` → `redCore` (RedCore, aof_backend/src/routes/resources.ts)
* `sandWhite` → `clearQuartz` (ClearQuartz, aof_backend/src/routes/resources.ts)
* `sandPink` → `roseQuartz` (RoseQuartz, aof_backend/src/routes/resources.ts)
* `sandYellow` → `amberQuartz` (AmberQuartz, aof_backend/src/routes/resources.ts)
* `gemBlue` → `quantumBit` (QuantumBit, aof_backend/src/routes/resources.ts)
* `gemOrange` → `neuralChip` (NeuralChip, aof_backend/src/routes/resources.ts)
* `gemWhite` → `photonBit` (PhotonBit, aof_backend/src/routes/resources.ts)
* `gemGreen` → `bioChip` (BioChip, aof_backend/src/routes/resources.ts)
* `flaskBlue` → `cryoFluid` (CryoFluid, aof_backend/src/routes/resources.ts)
* `flaskYellow` → `voltFluid` (VoltFluid, aof_backend/src/routes/resources.ts)
* `flaskGreen` → `bioFluid` (BioFluid, aof_backend/src/routes/resources.ts)
* `flaskPink` → `nanoFluid` (NanoFluid, aof_backend/src/routes/resources.ts)
* `flaskPurple` → `quantumFluid` (QuantumFluid, aof_backend/src/routes/resources.ts)
* `loveHeart` → `soulCore` (SoulCore, aof_backend/src/routes/resources.ts)

## Что запрещено в этом плане

* оставлять алиасы или читать оба имени «на время перехода»;
* переставлять варианты `ResourceKind` или сдвигать коды ошибок;
* удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind и связанные mint-поля/капы до отдельного
  решения владельца;
* трогать семь отключённых инструкций из `docs/DEAD_CODE_EVIDENCE.md`;
* смешивать переименование с изменением экономики (формулы, капы, награды).

## Классификация на момент утверждения

* active-player (25): Data, Circuit, Silicon, Neuron, Synapse, Signal, Model, Power, Compute, Dataset, BlueCore, PurpleCore, RedCore, ClearQuartz, RoseQuartz, QuantumBit, NeuralChip, PhotonBit, BioChip, CryoFluid, VoltFluid, BioFluid, NanoFluid, QuantumFluid, Mind;
* active-internal (0): ;
* candidate-dead (2): AmberQuartz, SoulCore.

Статусы выведены из кода (`docs/RESOURCE_EVIDENCE.md`), а не назначены руками; удаление кандидатов
делается отдельным шагом после утверждения, не вместе с переименованием.

## Проверка после переименования

```bash
node scripts/resource-manifest.mjs --write && node scripts/resource-manifest.mjs --check  # drift 43 → 0
python3 scripts/idl-from-source.py aof_core --types ResourceKind
python3 scripts/idl-sync-ts.py && python3 scripts/check-idl-drift.py
python3 scripts/gen-core-instruction-table.py --check
node scripts/resource-usage.mjs --write && node scripts/resource-usage.mjs --check
node --test tests/readiness/*.test.cjs
```

Готовность шага C: `drift` в манифесте пуст, в active-коде нет farming-идентификаторов,
`unclassified` в инвентаре инструкций — 0, readiness зелёный, затем `anchor build` +
`git diff -- idls/` на машине с тулчейном.

