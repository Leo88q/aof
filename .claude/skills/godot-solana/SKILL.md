---
name: godot-solana
description: Godot + Solana SDK skill for AOF (game_id aof) — SolanaClient, WalletAdapter, AnchorProgram, Candy Machine, SPL builders, session keys analog against Watchtower OS v3. Use when building or reviewing the Unity/Godot client (farming crafting trading marketplace).
---

# Godot Solana Skill (AOF v3)

Best-free engine skill for the AOF client (`game/godot/`, mirror `game/unity/`).
Config source of truth: `GET /api/sdk/godot-solana?gameId=aof` (Watchtower OS v3).

## Ground rules

- tenant/game: `aof` (`tenant_id = 'aof'` in every shared table / RLS policy)
- network: `stage` (`stage=prototype`); commitment `finalized`
- program_ids: `AOF_CORE_PROGRAM_ID` + `CgInv111...` + `SessKeys111...` + `STrEaSuRy111...`
- never sign server-side; the co-sign pattern is: server builds tx → client signs →
  server verifies `eventsOf(sig)` → submit

## Modules (v1 7 layers, `game/godot/layers/` + `game/godot/chain/`)

1. **SolanaClient** (`chain/solana_client.gd`) — JSON-RPC, `getAccountInfo`,
   `sendTransaction`, MagicBlock `commit_state`; commitment `finalized`.
2. **WalletAdapter** (`chain/wallet_adapter.gd`) — Privy (guest + embedded wallet +
   gas sponsorship), Phantom FirstStep, Altude; cross-game link via RACE +
   idosgames bridge (PDA `studio_profile`).
3. **AnchorProgram** (`chain/anchor_program.gd`) — instruction builder for the four
   programs; always pass explicit accounts, never default signers.
4. **CandyMachine** (`chain/candy_machine.gd`) — cNFT drops via Bubblegum v2 Merkle
   Tree + MCC; cost model $110/M; Tensor is the primary venue.
5. **SplBuilders** (`chain/spl_builders.gd`) — ATA / mint_to / transfer / burn for
   Standard NFTs (golden tools, land) and resource mints.
6. **SessionKeys** (`chain/session_keys.gd`) — `createSession(AOF_CORE_PROGRAM_ID)`,
   `topUp 0.01 SOL`, `expiry 60 min`. `FORBIDDEN_IXS_MASK` must never drop
   `withdraw`, `transfer`, `payout` from the deny-list.

## v2 products / v3 SDKs

- 12 products live in `game/godot/products/` (farming … cross-game-materials)
- 13 best-free SDKs live in `game/godot/sdk/` (gamba, preset, ritarena, xandeum,
  pst, core-attributes, access-protocol, idosgames-wallet, security-auditing-skill,
  sentio-cli, solguard, solana-slam, arcium) — fetch each via
  `GET /api/sdk/<id>?gameId=aof` instead of hardcoding values.

## Asset standard (v3)

| itemType | rarity | standard | venue |
|---|---|---|---|
| common / seed / crop / material | any | cNFT ($110/M) | Tensor |
| golden_tool / land | any | Standard NFT | Magic Eden |
| tool | legendary | Standard NFT | Magic Eden |

Always attach Core Attributes (`GrowthStage`, `Position`, `Owner`, `Item`,
`source_game`, `is_cnft`, `asset_id`) and store farming states in Xandeum.

## L2 routing

`GET /api/l2/router?gameId=aof&tps=low&ux=gasless` — tps=low → MagicBlock ER
(sub-10ms, `delegate → executeGasless → commit state`, Magic Actions auto-harvest,
REPLA L3 settle); tps=high → Sonic HyperGrid; ux=private → Arcium + PST overlay.

## Checklist before shipping a client build

1. `GET /api/os/config` → 33 components, program_ids match;
2. session key denies withdraw/transfer/payout (unit-test `SessionKeys.allowed`);
3. assets routed through `GET /api/assets/strategy` (no hardcoded standard);
4. cross-game materials honor `mv_cross_game_materials_aof` (RLS tenant_id aof);
5. run the Security Auditing Skill (`.claude/skills/security-auditing/SKILL.md`);
6. `cd src/os && npm test && npm run smoke`.
