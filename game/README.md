# AOF — Unity/Godot project (v1 + v2 + v3)

Client project of **Age of Farming** (game_id `aof`, tenant `aof`, network `stage` / `prototype`)
against Watchtower OS v3 (`src/os/`, `GET /api/os/config`). Same layout for both engines:
`game/godot/` (detailed GDScript) and `game/unity/` (C# mirror).

## v1 — 7 layers
| Layer | Dir | Responsibility |
|---|---|---|
| L1 Platform | `layers/l1_platform.gd` | loop, config, HTTP, Watchtower OS client |
| L2 Identity | `layers/l2_identity.gd` | Privy guest/embedded wallet + gas sponsorship, Phantom FirstStep, Altude, Session Keys |
| L3 Chain | `layers/l3_chain.gd` + `chain/*` | SolanaClient, WalletAdapter, AnchorProgram, Candy Machine, SPL builders, session keys analog |
| L4 Assets | `layers/l4_assets.gd` | cNFT $110/M (Bubblegum v2 Merkle Tree, MCC, Tensor primary) + golden tools/land Standard NFT + Core Attributes (GrowthStage, Position) |
| L5 Economy | `layers/l5_economy.gd` | farming, crafting, trading, marketplace loops |
| L6 Data | `layers/l6_data.gd` | LaserStream gRPC, Shyft gPA 15ms + callbacks, PG+Timescale+Redis |
| L7 Ops | `layers/l7_ops.gd` | 19 control panels, handoff-v3, analytics feeds, security gates |

## v2 — 12 products (`products/`)
farming · crafting · trading · marketplace · inventory (common seeds/crops/materials) ·
golden-tools-land · session-wallet · tournaments (RitArena crop tournament) ·
crop-fighters (Husks) · craft-gamble (Gamba, house edge 5%, jackpot) ·
workers-depin (stake 10 SOL, escrow 0.1 SOL/100 players) ·
cross-game-materials (PDA studio_profile, ARC Entity IDs, Bolt entity IDs, RLS tenant_id aof)

## v3 — 13 best-free ideal SDKs (`sdk/`)
gamba · preset (official, over create-solana-game) · ritarena (over Aureus) · xandeum · pst ·
core-attributes · access-protocol · idosgames-wallet · security-auditing-skill · sentio-cli ·
solguard (130+, over SolShield) · solana-slam · arcium
— config served by `GET /api/sdk/<id>?gameId=aof`; base engine SDK is `GET /api/sdk/godot-solana?gameId=aof`.
