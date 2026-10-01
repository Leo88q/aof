# Аудит NFT-стандартов: Bubblegum V2, MPL Core, legacy NFT

Дата: 2026-10-01. Основа — только код репозитория (ветка `arena/01a0f563-aof`), без допущений о том, «что должно быть».
Охранный тест: `node --test tests/readiness/nft-standards.test.cjs` — он делает эти выводы проверяемыми: если кто-то
добавит Bubblegum/MPL Core/Token Metadata в программы, тест упадёт и потребует обновить этот документ.

## Ответ коротко

| Вопрос | Ответ (по коду) |
|---|---|
| Использует ли AOF **Bubblegum V2**? | **Нет.** Ни зависимости, ни CPI, ни Merkle-дерева, ни DAS-вызова, ни клиентской транзакции. Упоминания — это план, дескрипторы и заглушки. |
| Использует ли AOF **MPL Core** (Collection и т. п.)? | **Нет, совсем.** Нет крейта, нет CPI, нет коллекции. «Не удалять MPL Core Collection вслепую» — удалять нечего: её в репозитории нет. |
| Использует ли AOF **legacy NFT** (Metaplex Token Metadata)? | **Нет.** Нет `mpl-token-metadata`, нет metadata/master-edition аккаунтов. |
| Что тогда такое «NFT инструмента»? | **Обычный SPL-токен** (supply = 1, decimals = 0), выпущенный самой программой, плюс отдельный PDA `ToolData` с игровыми полями. |
| Нужно ли что-то удалять/менять сейчас? | **Нет.** Новая NFT-архитектура не добавлялась, существующее не удалялось. |

## Метод и воспроизведение

```bash
# 1. зависимости Rust: ни одного крейта Metaplex / compression
grep -c -E 'name = "(mpl-|mpl_core|spl-account-compression|spl-concurrent|bubblegum)' Cargo.lock     # → 0
grep -n -i -E 'mpl|bubblegum|compression|metaplex' Cargo.toml aof-core/Cargo.toml programs/*/Cargo.toml  # → пусто
# 2. исходники программ и валидаторные тесты
grep -rIn -i -E 'bubblegum|mpl[_-]?core|metaplex|spl_account_compression|merkle[_ ]tree|cnft|compressed' aof-core programs tests --include=*.rs --include=*.ts   # → пусто
# 3. кто вообще упоминает Bubblegum (список файлов ниже)
grep -rIl -i bubblegum . --exclude-dir=node_modules --exclude-dir=.git
```

В `Cargo.lock` встречается `spl-token-metadata-interface` — это **интерфейсный крейт SPL Token-2022** (транзитивная
зависимость `anchor-spl`), а не Metaplex.

## Доказательства по группам

### A. Программы (on-chain): отсутствие

| Факт | Источник |
|---|---|
| Ни один из 7 `Cargo.toml` не тянет `mpl-*`, `bubblegum`, `spl-account-compression` | `Cargo.toml`, `aof-core/Cargo.toml`, `programs/*/Cargo.toml` |
| Исходники и тесты не содержат `bubblegum`, `mpl_core`, `merkle tree`, `cnft`, `compressed` | grep по `aof-core/`, `programs/`, `tests/` — 0 совпадений |
| «NFT» инструмента — SPL-токен: `token::mint_to(…, 1)`; on-chain требуется `mint.decimals == 0`, `mint.supply == 0`, **без freeze authority**, `mint_authority == auth` (PDA программы) | `aof-core/src/instructions/mint_tool.rs`, `MintTool` в `aof-core/src/lib.rs` |
| Игровые поля лежат в PDA `ToolData` (161 байт с дискриминатором), а не в metadata-аккаунте | `aof-core/src/state.rs` (`ToolData`) |
| Коллекционные инструменты определяются **allowlist'ом** (`register_collector_mint`), потому что программа «не зависит от mpl-token-metadata, и „этот mint — Historian?“ по метаданным определить нельзя» | `aof-core/src/instructions/collector_stake.rs:74` |
| Чек-лист №46: «Программа не создаёт Metaplex-метаданные (зависимости от `mpl-token-metadata` нет): у инструментов нет on-chain update authority» | `SECURITY_CHECKLIST_GAMES_2026-09-26.md` |

### B. Документы: план, не реализация

* `docs/COMPRESSION_DESIGN.md` (2026-09-20): «**Статус: архитектурный план и offline-калькулятор, не интеграция и не разрешение mainnet.
  Ни Bubblegum, ни Light Protocol в текущий контракт не добавлены.**» Здесь же — единственное упоминание MPL Core: как свойство
  стандарта Bubblegum V2 («V2 … MPL Core collections»), а не как часть AOF.
* `docs/PRODUCTION_CHECKLIST.md`, `docs/PRODUCTION_DEPLOYMENT.md`, `docs/WATCHTOWER_OS_V3.md`, `AUDIT_2026-09-20.md`, `FINAL_REPORT_V3.md`,
  `WATCHTOWER_INTEGRATION.md` — упоминания в списках стека/рисков.

### C. Платформенный код — дескрипторы без транзакций

`src/os/assets-strategy.js`, `src/os/stack-v3.js`, `src/os/handoff-v3.js`, `src/os/control-panels-v3.js`,
`src/os/actix-gateway/src/main.rs`: возвращают **описание** («standard: cNft, protocol: Bubblegum v2, mintCostUsdPerMillion: 110,
Tensor primary») по запросу `GET /api/assets/strategy`. Тесты (`src/os/tests/os-v3.test.js`, `src/os/smoke-devnet.js`) проверяют
строки этих описаний. Ни одна функция не строит и не отправляет Bubblegum-транзакцию; SQL-схема `src/os/sql/cross_game_materials.sql`
хранит колонки `is_cnft`, `asset_id` как поля данных.

### D. Клиентские заглушки (game)

`game/godot/chain/candy_machine.gd` — один метод, который **возвращает словарь** `{"standard": "cNft", "protocol": "Bubblegum v2", …}`;
`game/godot/layers/l4_assets.gd`, `products/inventory.gd`, `game/unity/Assets/Scripts/Layers/L4Assets.cs`, `L3Chain.cs`, `Inventory.cs`,
`Marketplace.cs` — комментарии/описания слоя. Транзакций нет.

### E. Расчёты стоимости

`scripts/mint-cost-model.py` (+ `test-mint-cost-model.py`, `docs/audit/mint-cost-example.json`) — **офлайн-калькулятор** сравнения
`current_spl` / `bubblegum_hybrid` / `bubblegum_compressed_state`. Не интеграция.

### F. Backend

`aof_backend/src/lib/skrPrivilege.ts:64` — `// TODO: проверка владения NFT Saga/Seeker через Metaplex DAS API`. **Не реализовано:** привилегия
определяется только по токену SKR; владение NFT Saga/Seeker не проверяется.

### G. Инструкции для ИИ-агентов

`.claude/skills/godot-solana/SKILL.md`, `.claude/skills/security-auditing/SKILL.md` упоминают Bubblegum как знание для агента.
Это не код продукта (и файлы закреплены SHA-lock'ом — менять их без review нельзя).

## Выводы и что из них следует

1. **Bubblegum V2 — не реализован.** Корректная формулировка для всех документов: «запланировано / описано», не «используется».
   Дескрипторы `cNft … $110/M` в `src/os` и `game` рекламируют то, чего нет в контракте; их стоит читать как намерение
   (см. `docs/COMPRESSION_DESIGN.md`: передача asset ID вместо SPL mint сломает проверки `Account<Mint>`, ATA, custody и маркетплейс).
2. **MPL Core отсутствует.** Если в голове владельца он «где-то есть» — в этой кодовой базе его нет; удалять нечего и не следует
   добавлять «на всякий случай».
3. **Legacy NFT (Token Metadata) отсутствует.** У инструментов нет on-chain update authority и нет metadata-аккаунта; метаданные
   игры — `ToolData` + внешний JSON. Это согласуется с чек-листом №46.
4. **Что осталось нереализованным и честно названо:** DAS-проверка владения Saga/Seeker NFT (TODO в `skrPrivilege.ts`).
5. **Не делалось (по условиям задачи):** новая NFT-архитектура, миграция SPL → cNFT, добавление зависимостей, удаление чего-либо.

## Если Bubblegum/MPL Core когда-нибудь появится

Охранный тест остановит CI. Чтобы его обновить, сначала выполните пилот из `docs/COMPRESSION_DESIGN.md` («Безопасная архитектура pilot»,
10 пунктов — private tree под PDA, `AssetRef` с явным видом, on-chain проверка proof/root, атомарный freeze + смена статуса,
негативные on-chain тесты), а затем обновите этот документ и список разрешённых файлов в `tests/readiness/nft-standards.test.cjs`.
