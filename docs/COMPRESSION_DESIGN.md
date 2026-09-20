# NFT compression: решение для AOF, 2026-09-20

**Статус: архитектурный план и offline-калькулятор, не интеграция и не разрешение mainnet.**
Ни Bubblegum, ни Light Protocol в текущий контракт не добавлены. Передача asset ID вместо SPL mint сломает проверки `Account<Mint>`, ATA, custody и marketplace. Нельзя исправить это заменой SDK в backend.

## Что действительно использует проект

- Anchor 0.30.1, классический `anchor_spl::token::Token`, singleton PDA Config, PDA mint authority, ToolData отдельно от SPL mint.
- Нет CPI Bubblegum/Light, DAS ownership proofs, cNFT settlement, Token-2022 account extensions.
- MintTool создаёт supply=1 у SPL mint с decimals=0; это **не полноценная интеграция Metaplex NFT metadata/collection**. Приписывать текущей реализации цену Token Metadata NFT (~несколько аккаунтов metadata/master edition) неправильно: их здесь нет.
- ToolData резервирует 161 байт вместе с discriminator. Удаление Mint+ATA не удаляет этот rent. Нельзя обещать «NFT за 0.00001 SOL», оставив полноценный ToolData PDA на каждый NFT.

## Bubblegum и ZK Compression — не одно и то же

**Bubblegum V2** — стандарт compressed NFTs с Merkle leaves, MPL Core collections, freeze/thaw, delegates и soulbound-возможностями. Для чтения активов/доказательств нужен DAS. V2 несовместим с V1 trees и не поддерживает decompression в обычный NFT. Это важно для выбранного пути миграции. [1](https://www.metaplex.com/docs/smart-contracts/bubblegum-v2/faq) [3](https://www.metaplex.com/docs/smart-contracts/bubblegum-v2)

**ZK Compression / Light** — примитив compressed token accounts и PDA с validity proofs. Это отдельный стек состояния, а не опция Bubblegum «включить ZK». В документации приводятся ориентиры ~5,000 lamports за compressed token account и ~15,000 за 100-byte compressed PDA; это не цена всего игрового действия и не замер 161-byte ToolData. [3](https://www.zkcompression.com/welcome)

Compression уменьшает стоимость хранения, но **не лечит** некорректную эмиссию, компрометацию authority, ошибки доступа и случайность. Не даёт приватности игровых данных сама по себе.

## Рекомендация

| Класс данных | Первое безопасное решение | Следующий этап |
|---|---|---|
| Текущие торгуемые/арендуемые инструменты | Сохранить SPL custody до полного набора settlement-тестов | Отдельная Bubblegum V2 коллекция с новым ownership adapter |
| Массовые косметические NFT/бейджи | Лучший кандидат на Bubblegum V2 pilot | Ограниченный tree, без экономических привилегий |
| Часто меняющийся durability/mining timer | Обычный компактный PDA в первом pilot | Light только после замера prove/write latency и конкуренции |
| Редко читаемые достижения/claim receipts | Оценить compressed PDA/nullifiers | Атомарная on-chain дедупликация + reward mint |
| Активно используемые ресурсы в SPL DEX | Не ломать SPL composability | Compressed distribution с явно протестированным compress/decompress |

Не выдавать permanent transfer/burn delegates серверу просто «для безопасности». Это новые полномочия изъятия. Если они нужны игре, ограничить PDA-политикой, раскрыть пользователям и отдельно проверить.

## Безопасная архитектура pilot

1. Зафиксировать SDK/program IDs и версии V2, проверенные аудитом протокола; отделить devnet/mainnet manifest. Сохранить program data/upgrade authority и release hashes. Никаких `latest` в релизе.
2. Создать **private tree**, управляемый ограниченным mint-authority PDA. Валидировать дерево, его owner/program, tree config, collection и все CPI program IDs на цепи. Не принимать их из HTTP без on-chain constraints.
3. Новый `AssetRef` имеет явный вид `Spl { mint }` или `Compressed { tree, nonce, asset_id }`. Не смешивать значения в старом `mint` поле. PDA game state привязать к canonical asset ID.
4. DAS предоставляет данные и proof, **не авторизацию**. On-chain проверить proof/root, leaf owner/delegate, nonce/index, data hash, creator/collection hash и коллекцию. Проверять подпись владельца независимо от backend.
5. Staking/custody должен атомарно freeze/transfer leaf **и** менять игровой статус. Unstake снимает ровно этот lock. Отдельно тестировать listing, auction, rental, craft burn/mint и concurrent transfer; при любом CPI failure всё откатывается.
6. При миграции SPL -> cNFT атомарно burn/lock старый актив, установить необратимый migration receipt и создать новый. Replay/повторный mint невозможен. Старый PDA не должен давать права одновременно с новым. V2 decompression не использовать как выдуманный rollback.
7. Для Light потребовать authenticated program ownership, validity proof, nullifier/replay protection и атомарность reward/state transition. Никаких переводов вознаграждения по одному ответу indexer.
8. DAS/prover failure => fail closed, bounded retry с обновлением proof, без повторной оплаты/эмиссии. Минимум два независимых RPC/indexer-пути, backup/rebuild rehearsal. Нельзя гарантировать доступность только математической корректностью proof.
9. Tree capacity, canopy, transaction bytes и CU выбирать из load test. ALT необходим только когда действительно нужен размер; текущий txGuard **запрещает ALT**, поэтому для pilot сначала реализовать полное разрешение адресов и повторную проверку всей инструкции, не просто добавить Bubblegum в allowlist.
10. До выпуска: wrong-owner/tree/collection, stale-root, replay, exhausted tree, missing canopy/prover, concurrent transfer/stake/rent, failed CPI, migration double-spend, auction settlement, burn после transfer. Ожидается on-chain negative-test suite, не только snapshot/regex.

## Расчёт стоимости без маркетинговых обещаний

```
current = N * (Mint rent + ATA rent + ToolData rent + network fees)
hybrid  = ceil(N / tree_capacity) * tree rent + collection/setup
          + N * (Bubblegum mint fee + network fees + ToolData rent)
          + RPC/indexer/retries/operations budget
compressed_state = hybrid, но обычный ToolData rent заменён measured Light state cost
```

В официальном отчёте Metaplex за декабрь 2025 указаны Bubblegum V2 creation fee **0.00009 SOL** и transfer fee **0.000006 SOL**. Это отдельные protocol fees, которые нельзя терять за рекламной ценой leaf/tree storage; перепроверить перед релизом. [5](https://www.metaplex.foundation/blog/articles/metaplex-december-round-up-2025)

FAQ приводит пример tree на 16,384 NFT с rent около 0.34 SOL (стоимость зависит от depth/canopy). **Делить надо на реально выпущенное количество**, не на максимальную ёмкость. [1](https://www.metaplex.com/docs/smart-contracts/bubblegum-v2/faq)

Калькулятор без сети/ключей:

```bash
python3 scripts/mint-cost-model.py docs/audit/mint-cost-example.json
python3 scripts/test-mint-cost-model.py
```

Пример на 10,000 активов, **только допущения из JSON**:

| Сценарий | SOL | Что не доказано |
|---|---:|---|
| Текущий SPL + ToolData | 55.2732 | rent/network fee надо снять с выбранного RPC |
| Bubblegum + обычный ToolData | 21.4644 | setup 0.01 SOL — условный бюджет; нет pilot |
| Bubblegum + compressed game state | 1.5 | 15,000 lamports state — ориентир 100-byte PDA, не замер AOF |

Нулевой operations budget в примере **исключает**, а не доказывает отсутствие затрат на DAS/prover/hosting. Нет обещания окупаемости и фиксированного процента экономии. Для одного NFT tree может оказаться дороже текущей схемы. Нужны замеры для 100/10k/100k активов и 1/10/100 изменений состояния на актив.

## Другие Solana-инструменты

- **Squads / разделение ключей:** целесообразны для upgrade authority и treasury. Нельзя просто заменить `Config.authority` на multisig PDA и оставить `Keypair.fromSecretKey`: потребуется отдельный governance/execution flow и ограниченный operational signer.
- **VRF:** выбрать проверяемый провайдер после проверки актуальных SDK/audits. Привязать request к user/commit/правилам, исключить reuse старого randomness, freeze odds на commit и сделать settlement permissionless после fulfillment. VRF без обязательного settlement всё ещё допускает selective abort.
- **Token-2022:** полезен для отдельных токенов, но transfer fees/hooks/permanent delegates меняют семантику. Не подключать ко всем NFT автоматически; нынешние `Account<TokenAccount>` и token CPIs не поддерживают такой переход.
- **Priority fees/CU budget:** ограничены wallet guard; автоматический CU/priority estimator допустим только с hard caps и пользовательским лимитом расхода.
- **ALT:** оптимизация размера, не цены rent и не самостоятельная мера безопасности.

## Уточнение после второго этапа аудита: стоимость reward receipts

Новый `RewardReceipt` — **обычный**, не сжатый PDA, 121 байт с discriminator, отдельный от NFT и ToolData. Он сохраняется навсегда для защиты одного reward ID после DB restore. Rent платится за каждую выплату; его нельзя вернуть закрытием квитанции без потери replay protection. NFT cost calculator не включает поток inbox rewards и не должен применяться к нему как готовый total budget.

Для бюджета получить актуальный `getMinimumBalanceForRentExemption(121)` у утверждённого cluster RPC, умножить на число уникальных rewards и добавить network fee, Player/ATA creation. Не принимать сравнительные цифры Light за фактическую стоимость этой реализации.

Именно такой редко изменяемый replay tombstone — разумный **кандидат** на отдельный Light compressed-state/nullifier pilot. Нужны atomic mint+nullifier, постоянная уникальность ID, restore/replay/concurrent-proof tests, trusted root/freshness policy, cost/latency для prover/indexer и fail-closed поведение без proof. Нельзя просто заменить Account PDA на API-запись или автоматически закрывать старые receipts после «архивации». Bubblegum cNFT сам по себе не заменяет nullifier и не ограничивает authority issuance.
