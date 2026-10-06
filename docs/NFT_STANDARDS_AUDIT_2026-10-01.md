# Аудит NFT-стандартов: Bubblegum V2, MPL Core и Tool NFT

**Обновлено: 2026-10-06.** Первоначальный срез от 2026-10-01 устарел: staged-код для Tool NFT с тех пор добавил CPI в Metaplex Token Metadata. Этот документ описывает текущую реализацию по исходникам; он не утверждает, что код уже собран или проверен в Devnet.

Охранный тест: `node --test tests/readiness/nft-standards.test.cjs`. Он отдельно запрещает незапланированную интеграцию compressed-NFT стандартов и проверяет инварианты текущего SPL + Token Metadata пути.

## Ответ коротко

| Вопрос | Ответ по текущему коду |
|---|---|
| Использует ли AOF **Bubblegum V2** или compressed NFTs? | **Нет.** Нет Bubblegum CPI, Merkle tree, cNFT settlement или DAS-проверки владения. |
| Использует ли AOF **MPL Core**? | **Нет.** Нет MPL Core CPI, коллекции MPL Core или Core asset adapter. |
| Как выпускается Tool NFT? | Обычный SPL-токен (`decimals = 0`, один token, authority-PDA) с legacy NFT metadata (Metaplex Token Metadata) и Master Edition; игровой state отдельно хранится в `ToolData`. |
| Откуда берутся URI? | Из 25-slot `ToolMetadataRegistry`; выдача требует инициализированный и замороженный registry. JSON и изображения размещаются вне сети. |
| Проверен ли staged CPI в Devnet? | **Нет в рамках этой code-only работы.** Локальные Rust/Anchor build, Devnet транзакции, mint и smoke-прогоны не выполнялись. |

## Что именно реализовано в исходниках

- `aof-core/Cargo.toml` включает Anchor SPL metadata feature. Общий helper `aof-core/src/instructions/settlement.rs::mint_tool_nft`:
  - минтит ровно один SPL token;
  - создаёт Metaplex Metadata через `CreateMetadataAccountV3` и Master Edition через `CreateMasterEditionV3`;
  - берёт URI и `seller_fee_basis_points` из `ToolMetadataRegistry`;
  - использует пустой symbol, `creators = None`, `collection = None`, `is_mutable = false` и `max_supply = Some(0)`.
- `MintTool` проверяет `decimals == 0`, начальный `supply == 0`, отсутствие freeze authority и mint authority, равный program PDA. Metadata/Master Edition PDA и Token Metadata program проверяются Anchor-контекстом.
- `ToolMetadataRegistry` содержит 25 URI. `metadata_uri()` отказывает до `initialized && frozen`; конфигурационная инструкция замораживает registry только при заполнении всех слотов и уникальности URI. Для Devnet Cloudflare-пилота seller fee задан как 0 bps.
- `ToolData` остаётся игровым account и не заменяется JSON metadata. Внешний Pages-хостинг может изменить доступность/ответ для URI; versioned paths и публичный verifier снижают риск, но не превращают Cloudflare в immutable storage.
- Collector allowlist не определяет право по произвольной Token Metadata коллекции: eligible mints регистрируются отдельной authority-инструкцией.

### Что не используется

- Bubblegum V1/V2, MPL Core, Light Protocol, compressed assets, Merkle proofs/trees и DAS APIs не интегрированы. Их упоминания в архитектурных материалах/дескрипторах не являются транзакционным кодом.
- Транзитивный `spl-token-metadata-interface` в Cargo.lock сам по себе не означает Metaplex Token Metadata CPI; CPI-путь выше вызывается явно через Anchor SPL metadata API.
- Backend `aof_backend/src/lib/skrPrivilege.ts` по-прежнему содержит TODO для проверки владения Saga/Seeker через Metaplex DAS; она не реализована.

## Проверяемые исходники и тесты

- `aof-core/src/instructions/settlement.rs` — mint, Metadata/Master Edition CPI и immutable-параметры.
- `aof-core/src/lib.rs` — MintTool, metadata/edition PDA constraints и Token Metadata program account.
- `aof-core/src/state.rs` — frozen URI registry и slot lookup.
- `aof-core/src/instructions/tool_metadata.rs` — обновление URI и freeze gate.
- `tests/readiness/nft-standards.test.cjs` — compressed-NFT absence, mint invariants, metadata CPI configuration and registry freeze.
- `docs/TOOL_NFT_METADATA_RELEASE.md` — локальный Cloudflare bundle/проверка 50 URL и отдельные Devnet release gates.

## Оставшиеся проверки

1. На Mac владельца собрать все шесть программ закреплёнными Rust/Anchor версиями и сверить IDL. В этой среде build не запускался.
2. На Devnet проверить Metadata/Master Edition account sizes, rent, PDA constraints и фактические CPI; отдельно проверить, что Metadata immutable и Master Edition не допускает child editions.
3. Проверить endpoint-хостинг для всех 50 объектов до записи URI, затем проверить владельца, supply/decimals, ToolData, Metadata PDA, Master Edition и JSON/image для всех 25 mint.
4. Не включать mining до одобрения четырёх конечных issuance caps, совпадения bytecode всех шести программ и успешных smoke gates.
5. Для будущего Bubblegum/MPL Core пилота сначала обновить ownership adapter, custody/marketplace semantics, proofs, replay protection и negative on-chain tests (см. `docs/COMPRESSION_DESIGN.md`). Нельзя подменять текущий SPL mint compressed asset ID без отдельного архитектурного изменения.
