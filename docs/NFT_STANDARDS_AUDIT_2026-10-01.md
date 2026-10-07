# Аудит NFT-стандартов: Bubblegum V2, MPL Core и Tool assets

**Обновлено: 2026-10-07.** Этот документ описывает выбранную metadata-only реализацию по исходникам. Изменения ещё должны пройти обязательные проверки PR; этот текст не утверждает, что код уже собран или проверен в валидаторе.

Охранный тест: `node --test tests/readiness/nft-standards.test.cjs`. Он отдельно запрещает незапланированную интеграцию compressed-NFT стандартов и проверяет текущие SPL, Metaplex Metadata и authority-инварианты.

## Ответ коротко

| Вопрос | Ответ по текущему коду |
|---|---|
| Использует ли AOF **Bubblegum V2** или compressed NFTs? | **Нет.** Нет Bubblegum CPI, Merkle tree, cNFT settlement или DAS-проверки владения. |
| Использует ли AOF **MPL Core**? | **Нет.** Нет MPL Core CPI, коллекции MPL Core или Core asset adapter. |
| Что выпускает AOF как Tool NFT? | 0-decimal classic SPL mint с supply 1 и immutable legacy Metaplex Token Metadata. **Master Edition намеренно не создаётся**: это metadata-only asset, а не canonical Metaplex Master Edition NFT. Для Metadata CPI mint временно создаётся с auth PDA как freeze authority; после CPI helper отзывает и mint, и freeze authority, поэтому финальный `freeze_authority == None`. Игровой state отдельно хранится в `ToolData`. |
| Каков compatibility tradeoff? | Некоторые кошельки, marketplaces и индексаторы могут не распознать asset как стандартный Metaplex NFT или показать его неполно, поскольку отсутствует Master Edition. Существующие AOF ownership, marketplace и custody guards остаются обязательными. |
| Откуда берутся URI? | Из 25-slot `ToolMetadataRegistry`; выдача требует инициализированный и замороженный registry. JSON и изображения размещаются вне сети. |
| Проверены ли обязательные сборка и локальные тесты? | **Пока нет.** Rust/Anchor и validator tooling недоступны в этой среде; PR не должен сливаться, пока обязательные проверки не пройдут. Никакой production registry change или deployed-network transaction не выполнялся. |

## Что именно реализовано в исходниках

- `aof-core/Cargo.toml` включает Anchor SPL metadata feature. Общий helper `aof-core/src/instructions/settlement.rs::mint_tool_nft`:
  - минтит ровно один classic SPL token;
  - создаёт только Metaplex Metadata через `CreateMetadataAccountV3`; Master Edition CPI и аккаунт отсутствуют;
  - после успешного Metadata CPI отзывает `MintTokens` и `FreezeAccount` у auth PDA: supply нельзя увеличить, а выпущенный mint нельзя заморозить;
  - берёт URI и `seller_fee_basis_points` из `ToolMetadataRegistry`;
  - Metadata CPI списывает с payer'а rent аккаунта **и flat 0.01 SOL (10 000 000 lamports) fee Metaplex**, который остаётся внутри Metadata account; этот fee входит в `tool_settlement_rent`, в reimbursement сеттлера и в payer quotes (`METAPLEX_CREATION_FEE_LAMPORTS`);
  - использует пустой symbol, `creators = None`, `collection = None` и `is_mutable = false`.
- Mint-контексты требуют `decimals == 0`, начальный `supply == 0`, mint authority равный program PDA и временный freeze authority, равный тому же PDA. Metaplex отклоняет этот 0-decimal supply-1 mint без freeze authority; общий helper отзывает `MintTokens` и `FreezeAccount` после Metadata CPI в той же атомарной инструкции. Итог: supply 1 и обе authority `None`. Metadata PDA и Token Metadata program проверяются Anchor-контекстом; Master Edition PDA в нём нет.
- `ToolMetadataRegistry` содержит 25 URI. `metadata_uri()` отказывает до `initialized && frozen`; конфигурационная инструкция замораживает registry только при заполнении всех слотов и уникальности URI. Для Devnet Cloudflare-пилота seller fee задан как 0 bps.
- `ToolData` остаётся игровым account и не заменяется JSON metadata. Внешний Pages-хостинг может изменить доступность/ответ для URI; versioned paths и публичный verifier снижают риск, но не превращают Cloudflare в immutable storage.
- Collector allowlist не определяет право по произвольной Token Metadata коллекции: eligible mints регистрируются отдельной authority-инструкцией.

### Что не используется

- Bubblegum V1/V2, MPL Core, Light Protocol, compressed assets, Merkle proofs/trees и DAS APIs не интегрированы. Их упоминания в архитектурных материалах/дескрипторах не являются транзакционным кодом.
- Транзитивный `spl-token-metadata-interface` в Cargo.lock сам по себе не означает Metaplex Token Metadata CPI; выбранный Metadata CPI вызывается явно через Anchor SPL metadata API.
- Backend `aof_backend/src/lib/skrPrivilege.ts` по-прежнему содержит TODO для проверки владения Saga/Seeker через Metaplex DAS; она не реализована.

## Проверяемые исходники и тесты

- `aof-core/src/instructions/settlement.rs` — mint, immutable Metadata CPI и последующая отмена mint authority.
- `aof-core/src/lib.rs` — MintTool, Metadata PDA constraint, временный freeze authority auth PDA и его отзыв до завершения issuance, Token Metadata program account.
- `aof-core/src/state.rs` — frozen URI registry и slot lookup.
- `aof-core/src/instructions/tool_metadata.rs` — обновление URI и freeze gate.
- `tests/readiness/nft-standards.test.cjs` — отсутствие compressed-NFT интеграции, mint invariants, Metadata-only CPI, authority revoke и registry freeze.
- `tests/aof_payer_funding.ts` и `tests/aof_vrf_localnet.ts` — при запуске на изолированном валидаторе проверяют supply, mint/freeze authorities, отсутствие Master Edition и rent accounting.
- `docs/TOOL_NFT_METADATA_RELEASE.md` — подготовка metadata bundle и отдельные release gates.

## Оставшиеся проверки

1. Пройти обязательные закреплённые Rust/Anchor сборку, тесты и IDL drift проверки до merge; в этой среде Rust/Anchor build и validator suite не запускались.
2. На изолированном локальном валидаторе проверить все issuance paths: supply 1, decimals 0, `mint_authority == None`, `freeze_authority == None`, immutable Metadata, отсутствие Master Edition и точный rent reimbursement. Не отправлять эти транзакции в Devnet/mainnet в рамках code-only работы.
3. Любой последующий metadata hosting/registry release — отдельное действие с отдельным одобрением. Не менять production registry и не включать mining без всех release gates.
4. Для будущего Bubblegum/MPL Core пилота сначала обновить ownership adapter, custody/marketplace semantics, proofs, replay protection и negative on-chain tests (см. `docs/COMPRESSION_DESIGN.md`). Нельзя подменять текущий SPL mint compressed asset ID без отдельного архитектурного изменения.
