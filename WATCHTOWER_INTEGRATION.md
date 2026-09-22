# WATCHTOWER_INTEGRATION.md — AOF v3 (Watchtower OS v3, Ideal Free Stack)

| Поле | Значение |
|---|---|
| **game_id** | `aof` |
| **tenant_id** | `aof` (Postgres RLS `tenant_id = 'aof'`) |
| **name** | Age of Farming — farming crafting trading marketplace |
| **network** | `stage` (`stage=prototype`) |
| **program_ids** | `AOF_CORE_PROGRAM_ID` + `CgInv111...` + `SessKeys111...` + `STrEaSuRy111...` |
| **stack** | Watchtower OS v3 — 33 компонента ideal free stack (deduplicated, same as ARES-1) |
| **config API** | `GET /api/os/config` (`src/os/server.js`) |

## program_ids

| Symbolic | Alias | Resolved id | Статус |
|---|---|---|---|
| `AOF_CORE_PROGRAM_ID` | aof_core | `HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq` | deployed (devnet reference) |
| `CgInv111...` | aof_cginv (craft-gamble inventory) | `CgInv1111111111111111111111111111111111111` | stage-prototype placeholder |
| `SessKeys111...` | aof_session_keys | `SessKeys11111111111111111111111111111111111` (deployed: `6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5`) | stage-prototype placeholder |
| `STrEaSuRy111...` | aof_treasury | `STrEaSuRy1111111111111111111111111111111` | stage-prototype placeholder |

## Dedup (ideal free, same as ARES-1)

| Держим | Отбрасываем | Почему |
|---|---|---|
| **Preset** | create-solana-game | best free **official** scaffold |
| **RitArena** | Aureus | lifecycle + retry events, best free arena |
| **SolGuard** | SolShield | 130+ checks, best free |

## 33 компонента (GET /api/os/config → componentsTotal: 33)

Identity: **Privy** · **Phantom FirstStep** · **Altude** · **Session Keys** (0.01 SOL)
Assets: **cNFT $110/M** (Bubblegum v2 Merkle Tree, MCC, Tensor primary) · **Core Attributes** (on-chain key-value, GrowthStage, Position, DAS 5ms)
Storage: **Xandeum** (exabyte, лучше Arweave)
Indexer: **LaserStream** (gRPC) · **Shyft** (gPA 15ms) · **PG + TimescaleDB + Redis**
L2: **Sonic HyperGrid** · **MagicBlock ER** (sub-10ms gasless Magic Actions)
Privacy: **Arcium** (confidential) · **PST** (private verifiable)
Analytics: **Helika** · **GameSight** · **Game Signals ML** (60M+ tx, churn >85%)
Marketplace: **ME** (120 QPM) · **GameShift** (USD 170+) · **Tensor** · **Gamba** · **Husks** · **RitArena** · **RACE** · **Access** · **idosgames**
Engines: **Unity** · **Godot**
Agents: **relayzero** · **StealthSDK**
Security: **Security Skill + Sentio + SolGuard** (группа; 3 продукта)
Testing: **SLAM + Preset** (группа; 2 продукта)
Infra: **ARC + Bolt + DePIN + Rust Actix** (группа; 4 продукта)

## Identity Session Keys (Godot detailed)

Privy Phantom FirstStep Altude — guest gas sponsorship embedded wallet, auto
cross-game материалы RLS `tenant_id = aof` + materialized view
`mv_cross_game_materials_aof` (`src/os/sql/cross_game_materials.sql`).
Session Keys: `createSession(AOF_CORE_PROGRAM_ID)`, `topUp 0.01 SOL`,
`expiry 60 min`, `FORBIDDEN_IXS_MASK` = withdraw/transfer/payout.
Godot SolanaClient · WalletAdapter · AnchorProgram · Candy Machine · SPL builders ·
session keys analog (`game/godot/chain/`) + Claude Skill
(`.claude/skills/godot-solana/SKILL.md`) + Security Auditing Skill
(`.claude/skills/security-auditing/SKILL.md`) — systematic audit, best free security skill.

## Assets

common seeds crops materials → **cNFT $110/M** (Bubblegum v2 Merkle Tree, MCC,
Tensor primary); golden tools land → **Standard NFT**; **GrowthStage Position**
через **Core Attributes** on-chain key-value, читаемые программами, DAS 5ms —
best free on-chain stats; farming states → **Xandeum** (exabyte scalable,
better than Arweave); crafting gamble → **Gamba** wager NFT provably fair
house edge 5% jackpot (`CgInv111...`); crop fighters → **Husks** + **RitArena**
crop tournament lifecycle retry events — best free arena, chosen over Aureus.
Стратегия: `GET /api/assets/strategy?gameId=aof&itemType=common&rarity=common`.

## Infra

**ARC Entity** crop plot + **Components** Position GrowthStage Owner Item +
`source_game=aof`, `is_cnft`, `asset_id` + **System** harvest craft ·
**Bolt FOCG** farming: Plot Crop Player systems plant harvest ·
**DePIN** crafting market workers: stake 10 SOL, escrow 0.1 SOL per 100 players,
reward slash · **Arcium** confidential privacy best free · **Xandeum** scalable
exabyte best free · **PST** private verifiable best free · **Core Attributes**
on-chain key-value best free · **Preset** official scaffold farming best free
official · **Rust Actix** high-performance (`src/os/actix-gateway/`) ·
**Access Protocol** stake-to-access rare crops golden tools land ·
**idosgames** bridge EVM Solana RewardPool.
API: `GET /api/infra/arc|bolt|depin|actix|preset|xandeum|pst|core-attributes|arcium|access|idosgames|crossgame|overview?gameId=aof`.

## L2

**MagicBlock ER** sub-10ms gasless: delegate → executeGasless → commit state,
**Magic Actions** auto harvest + **REPLA L3** Anchor settle MagicBlock sequencer ·
**Sonic HyperGrid** · **Arcium** confidential privacy best free · **PST** private ·
**Xandeum** exabyte — ideal free L2 privacy storage.
Роутинг: `GET /api/l2/router?gameId=aof&tps=low&ux=gasless` (tps=low→MagicBlock ER,
tps=high→Sonic HyperGrid; ux=gasless→Magic Actions, ux=private→Arcium+PST).

## Indexer

**LaserStream** gRPC `AOF_CORE_PROGRAM_ID` + `CgInv111...` + `SessKeys111...` +
`STrEaSuRy111...` · ARC Bolt DePIN Gamba Husks RitArena RACE Arcium Xandeum PST
Core Attributes события · **Shyft** callbacks `TOKEN_MINT` `NFT_MINT` gPA 15ms ·
**PG TimescaleDB Redis** idempotency gap backfill finalized reconciliation
(ledger: `watchtower/`, `aof_backend/services/chain-indexer`).

## Analytics

**Helika** cross-game dashboard + **GameSight** `solana_wallet` `external_id`
Late ID Binding ad→on-chain attribution + **Game Signals ML** 60M+ tx 12 games
churn 14d >85% common wallets funnel LTV cross-game retention + farming crafting
trading marketplace analytics. `GET /api/game-signals/config?gameId=aof`.

## Marketplace

**ME** 120 QPM + **Shyft** escrow-less + **GameShift** USD 170+ + **Tensor** cNFT +
**Gamba** + **Husks** + **RitArena** best free + **RACE** + **Access** stake-to-access
best free + **idosgames** bridge best free.

## Security Testing Storage Privacy Monetization AI Cross-Chain

Security Auditing Skill + **Sentio** + **SolGuard** 130+ best free + **SLAM** LiteSVM +
**Preset** official + **Xandeum** exabyte + **PST** private + **Core Attributes** +
**Arcium** confidential + **Access** + **idosgames** + **Husks** crop fighters +
**RitArena** crop tournament lifecycle retry events best free + **relayzero** +
**StealthSDK** + **RACE** multichain + **idosgames** bridge + **19 control panels**
`src/os/control-panels-v3.js` + `src/os/handoff-v3.js`.

## Unity/Godot project

`game/godot/` (detailed) + `game/unity/` (C# mirror):
**v1 7 layers** (Platform, Identity, Chain, Assets, Economy, Data, Ops) +
**v2 12 products** (farming, crafting, trading, marketplace, inventory,
golden-tools-land, session-wallet, tournaments, crop-fighters, craft-gamble,
workers-depin, cross-game-materials) + **v3 13 best free ideal stack SDKs**
(gamba, preset, ritarena, xandeum, pst, core-attributes, access-protocol,
idosgames-wallet, security-auditing-skill, sentio-cli, solguard, solana-slam, arcium).
Подробности: `game/README.md`, `docs/WATCHTOWER_OS_V3.md`.

## Cross-game / Cross-chain

PDA `studio_profile` (seeds `[b"studio_profile"]`, `AOF_CORE_PROGRAM_ID`) ·
ARC Entity IDs · Bolt entity IDs · cross-chain linked wallets **RACE** +
**idosgames** bridge · cross-game материалы: ARC Entity-Component + Core Attributes
+ Xandeum, RLS `tenant_id = 'aof'`, materialized view `mv_cross_game_materials_aof` ·
handoff: `src/os/handoff-v3.js` → `GET /api/os/handoff?gameId=aof`.

## API проверки (все GET, gameId=aof)

| Endpoint | Что проверяем |
|---|---|
| `GET /api/os/config` | v3, 33 компонента, program_ids |
| `GET /api/sdk/godot-solana?gameId=aof` | SolanaClient WalletAdapter AnchorProgram Candy Machine SPL builders session keys analog + Claude Skill + Security Auditing Skill |
| `GET /api/sdk/gamba?gameId=aof` | wager NFT, provably fair, house edge 5%, jackpot |
| `GET /api/sdk/preset?gameId=aof&template=farming` | best free official (over create-solana-game) |
| `GET /api/sdk/ritarena?gameId=aof` | best free arena (over Aureus), lifecycle retry events |
| `GET /api/sdk/xandeum?gameId=aof` | exabyte storage |
| `GET /api/sdk/pst?gameId=aof` | private verifiable |
| `GET /api/sdk/core-attributes?gameId=aof` | on-chain key-value, DAS 5ms |
| `GET /api/sdk/access-protocol?gameId=aof` | stake-to-access |
| `GET /api/sdk/idosgames-wallet?gameId=aof` | EVM↔Solana bridge + RewardPool |
| `GET /api/sdk/security-auditing-skill?gameId=aof` | systematic audit skill |
| `GET /api/sdk/sentio-cli?gameId=aof` | tracing + anomalies |
| `GET /api/sdk/solguard?gameId=aof` | 130+ best free (over SolShield) |
| `GET /api/sdk/solana-slam?gameId=aof` | SLAM LiteSVM |
| `GET /api/sdk/arcium?gameId=aof` | confidential |
| `GET /api/infra/*?gameId=aof` | arc bolt depin actix preset xandeum pst core-attributes arcium access idosgames crossgame overview |
| `GET /api/game-signals/config?gameId=aof` | best free ML 60M+, churn >85% |
| `GET /api/l2/router?gameId=aof&tps=low&ux=gasless` | L2-роутинг: MagicBlock ER gasless / Sonic HyperGrid (+ Arcium/PST private, REPLA L3) |
| `GET /api/assets/strategy?gameId=aof&itemType=common&rarity=common` | cNFT $110/M vs Standard NFT |
| `GET /api/os/control-panels?gameId=aof` | 19 control panels |
| `GET /api/os/handoff?gameId=aof` | handoff-v3 cross-game + agents |
| `GET /api/os/final-report?gameId=aof` | 20 пунктов |

Запуск: `cd src/os && npm start` (порт 8787, `WATCHTOWER_OS_PORT`).
Проверка: `cd src/os && npm test && npm run smoke` (runtime smoke devnet —
прогоняет все endpoints + advisory-проба devnet RPC/программ).

## Tests + Runtime smoke devnet + Docs + Final report 20 пунктов

| Артефакт | Путь |
|---|---|
| Tests (node:test) | `src/os/tests/os-v3.test.js` — `npm test` |
| Runtime smoke devnet | `src/os/smoke-devnet.js` — `npm run smoke` (`--offline` без RPC-пробы) |
| Docs | `WATCHTOWER_INTEGRATION.md` (этот файл) + `docs/WATCHTOWER_OS_V3.md` |
| Final report 20 пунктов | `FINAL_REPORT_V3.md` (источник: `src/os/handoff-v3.js` → `GET /api/os/final-report`) |
| Control panels (19) | `src/os/control-panels-v3.js` |
| Handoff | `src/os/handoff-v3.js` |
| RLS / materialized view SQL | `src/os/sql/cross_game_materials.sql` |
