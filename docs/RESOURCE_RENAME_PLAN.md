# План переименования ресурсов (шаг C пункта 12)

Результат rename-scan: **есть остатки — 26 legacy-идентификаторов в active code** (см. таблицу слоёв).
Статус шага C: **ОТКРЫТ — не завершён и не принят**. Нулевой scan подтверждает только отсутствие активных legacy identifiers; это не закрывает остальные acceptance gates.
Документ собирается `node scripts/resource-rename-plan.mjs --write`, гейт — `--check`
(`tests/readiness/resource-rename-plan.test.cjs`). Источники: `docs/RESOURCE_MANIFEST.json`
(канон имён и мест хранения) и `docs/RESOURCE_EVIDENCE.json` (классификация и флаги).

Канонический mapping: **27 ресурсов**, переименованных IDL-вариантов — 27,
переименованных полей минта — 27. Расхождений в манифесте: **0**.

## Слои (порядок работ владельца)

| Слой | Файлов проверено | Остатков | Статус |
|---|---:|---:|---|
| Rust (aof-core/src, programs/*/src) | 131 | 13 | ⚠️ переименовать |
| IDL и TS-типы (aof_backend/src/idl) | 7 | 0 | ✅ чисто |
| Backend (aof_backend/src, aof_backend/scripts) | 202 | 1 | ⚠️ переименовать |
| Frontend (frontend/src) | 286 | 12 | ⚠️ переименовать |
| Game (game/) | 72 | 0 | ✅ чисто |
| Тесты и скрипты (tests, scripts) | 136 | 0 | ✅ чисто |

Остатки в слое «Rust (aof-core/src, programs/*/src)»: **13** в 2 файле(ах).

| Файл | Найдено | Примеры (строка → токен) |
|---|---:|---|
| `aof-core/src/vrf.rs` | 8 | `90: seeds`, `92: seeds`, `94: seeds` |
| `aof-core/src/security_checklist_tests.rs` | 5 | `2053: seeds`, `2062: seeds`, `2063: seeds` |

Остатки в слое «Backend (aof_backend/src, aof_backend/scripts)»: **1** в 1 файле(ах).

| Файл | Найдено | Примеры (строка → токен) |
|---|---:|---|
| `aof_backend/src/routes/lottery.ts` | 1 | `30: "` |

Остатки в слое «Frontend (frontend/src)»: **12** в 3 файле(ах).

| Файл | Найдено | Примеры (строка → токен) |
|---|---:|---|
| `frontend/src/i18n/lotteryCopy.ts` | 8 | `13: potato`, `30: '`, `52: '` |
| `frontend/src/pages/market/LotteryHall.tsx` | 3 | `13: "`, `15: "`, `52: potato` |
| `frontend/src/lib/visualAssets.ts` | 1 | `15: potato` |

Правило гейта: остаток — это имя ресурса или старое имя инструкции, использованное как идентификатор.
Шаг C переименовал все farming-инструкции (deployment не выполнялся, дискриминаторы пересчитаны
и совпадают с `sha256("global:<canonical>")[0..8]`); старые имена обязаны ронять гейт.
Anchor-механика `seeds` (`seeds = [...]`, `findProgramAddressSync(seeds, …)`, `signer_seeds`) не
переименовывается и остатком не считается.

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
| `scripts/resource-drift.mjs` | drift detector contains its own legacy tokens, explicit mapping parser, and detector-level Anchor syntax rules; not product source |
| `scripts/resource-manifest.mjs` | список farming-алиасов, запрещённых в player-facing `display` |
| `scripts/resource-usage.mjs` | список алиасов для evidence-скана (кто где встречается) |
| `scripts/resource-rename-plan.mjs` | список legacy-форм и этот перечень — правила гейта |
| `scripts/layout-baseline.mjs` | явная таблица old→canonical для доказательства rename без смены layout; не runtime |
| `scripts/idl-from-source.py` | Anchor PDA `seeds` в генераторе IDL — не ресурс Neuron |
| `tests/readiness/resource-rename-plan.test.cjs` | негативные фикстуры: остаток обязан ронять гейт |
| `tests/readiness/resource-manifest.test.cjs` | негативные фикстуры алиасов в `display` |
| `tests/readiness/layout-baseline.test.cjs` | checks the historical `MaterialMints.seeds → neuron` rename against the pre-rename layout; mapping test, not product code |

## Что запрещено в этом плане

* оставлять алиасы или читать оба имени «на время перехода»;
* переставлять варианты `ResourceKind` или сдвигать коды ошибок;
* удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind и связанные mint-поля/капы до отдельного
  решения владельца;
* возвращать удалённые механики: барабан удачи, mind-spin, лук, скины, Switchboard и SKR-скидки;
* возвращать старые имена инструкций или создавать compatibility alias — шаг C их удалил;
* смешивать переименование с изменением экономики (формулы, капы, награды).

## Классификация на момент утверждения

* active-player (27): Data, Circuit, Silicon, Neuron, Synapse, Signal, Model, Power, Compute, Dataset, BlueCore, PurpleCore, RedCore, ClearQuartz, RoseQuartz, AmberQuartz, QuantumBit, NeuralChip, PhotonBit, BioChip, CryoFluid, VoltFluid, BioFluid, NanoFluid, QuantumFluid, SoulCore, Mind;
* active-internal (0): —;
* candidate-dead (0): .

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

## Приёмка шага C (отдельно от чистоты rename-scan)

Этот отчёт не объявляет Step C завершённым. Итоговая приёмка требует все 13 пунктов плана,
включая согласованные canonical discriminators во всех слоях, `global_active_resource_drift = 0`,
backend/frontend typecheck + frontend build + generated-client compile (или честный pending при
недоступном toolchain), payer/ownership/F-CURRENCY lamport-delta проверки и `anchor build` +
`anchor test --skip-build` с Anchor-generated IDL validation на Mac/CI. Deployment запрещён.
