# Age of Farming — Solana Migration Project

## 📚 Quick Start (ЧИТАЙ ПЕРВЫМ)
1. `AOF_migration_TOR_v2.md` — полное ТЗ (библия проекта, 500+ строк)
2. `progress.md` — текущий статус и история
3. `MIGRATION_STATUS.md` — статус миграции

## 🎯 Текущий прогресс

### ✅ Часть 1: On-chain программа — ЗАВЕРШЕНА
- **Commit:** `8893ac8` (part-1.1)
- **PID:** `HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq` (canonical ID in `aof-core`, `Anchor.toml`, backend IDL; deployment status must still be verified)
- **IDL:** 19 инструкций + событие `PaidOut` (критично для серверной верификации)
- **Архитектура:** модульная (lib.rs агрегатор → instructions.rs/state.rs/errors.rs/events.rs/constants.rs)
- **solana-program:** `=1.18.27` (обязательно, иначе SBPF mismatch)
- **Деплой:** через `solana program deploy` (anchor deploy глючит)

### 🔄 Часть 1b: Server wrapper — В ПРОЦЕССЕ
- ✅ `solana/aofClient.ts` (395 строк) — TypeScript SDK готов
- ✅ `solCore.js` — PDA, micros↔lamports, verifySolMessage
- 🔄 `functions/index.solana.js` — нужно дозавершить (замена Ronin handlers)
- ⏳ `functions/index.js` — старый Ronin-код (460KB ethers), останется до полного перехода

### ⏳ Часть 1c: Frontend client — НЕ НАЧАТА
- `WalletConnector.jsx` (268 строк) → миграция на `@solana/wallet-adapter-react`
- `QueryWallet.jsx` (183 строк) → миграция на `@solana/web3.js`
- `StakePanel.jsx`, `RerollPanel.jsx`, `MiningPanel.jsx`, `SettingsPanel.jsx`

## 🔧 Окружение
- **Solana CLI:** 4.2.1 (Agave)
- **Anchor:** 0.30.1
- **rustc:** 1.89.0
- **platform-tools:** v1.56
- **PATH:** `$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin`
- **Localnet:** test-validator запущен, 500M SOL на default wallet
- **Authority:** `solana/keys/aof-authority-devnet.json` (100 SOL на localnet)
- **Ветка:** `feat/solana-migration`

## ⚠️ Запрещённые команды
- `cargo build --features idl-build` (используй только `anchor build`)
- `anchor clean` (стирает кэш, 10+ мин перекомпиляции)
- Даунгрейды тулчейна
- Файлы `rust-toolchain` в репо
- `solana-test-validator --reset` если программа уже задеплоена

## 📋 Следующий шаг
Дозавершить `functions/index.solana.js` — заменить все Ronin handlers на Solana:
- mintNFTTool → buildCraftTx + submitSignedMint (co-sign)
- stakeNfts → buildStakeTx + verifyStake (сервер верифицирует событие)
- requestUnstake → buildUnstakeTx + verifyUnstake
- openPack → buildBurnPackTx + N×mintTool
- requestDeposit → vaultSplDelta (клиент делает SPL-transfer сам)
- requestWithdraw → buildWithdrawTx (co-sign)
- Все `ethers.verifyMessage` → `verifySolMessage` (tweetnacl sign.detached.verify)

## 🎯 Правила коммитов
После каждой части: `git commit -m "part-X.Y: <description>"`
- part-1.1 ✅ (aof-core deployed)
- part-1.2 (server wrapper) — следующий
- part-1.3 (frontend client)
- part-2.1 (test suite)

## 💡 Ключевые паттерны безопасности
- **Co-sign:** сервер строит tx → клиент подписывает → сервер верифицирует событие → submit
- **Дедупликация:** `sol_tx_log/{signature}` в Firestore
- **Сервер НИКОГДА не подписывает вслепую** — сначала верификация события через `eventsOf(sig)`
- **Комиссии только целыми числами** (micros): `FEE_PER_CRAFT_MICROS=100000` (0.1 SOL)
