# Watchtower OS v3 — NeuroForge (ex-AOF; Ideal Free Stack, 33 компонента)

Архитектура операционного слоя поверх NeuroForge (tenant `aof`, network `stage` /
`prototype`). Канонический JSON: `GET /api/os/config`. Состав стека и дедупликация:
`src/os/stack-v3.js`. Интеграционный чеклист: `WATCHTOWER_INTEGRATION.md`.

## Структура `src/os/`

| Файл | Роль |
|---|---|
| `config.js` | gameId aof, program_ids `AOF_CORE_PROGRAM_ID + CgInv111... + SessKeys111... + STrEaSuRy111...`, Session Keys / DePIN / Gamba / cross-game константы, gameId gate |
| `stack-v3.js` | 33 компонента ideal free stack + productIndex (39 продуктов) + 3 dedup-решения |
| `sdk-configs.js` | 14 SDK: godot-solana (базовый) + 13 v3 best-free SDK |
| `infra-configs.js` | infra: arc, bolt, depin, actix, preset, xandeum, pst, core-attributes, arcium, access, idosgames, crossgame, overview |
| `game-signals.js` | Game Signals ML: 60M+ tx, 12 games, churn-14d >85%, funnel/LTV/retention |
| `assets-strategy.js` | itemType×rarity → cNFT $110/M (Bubblegum v2, MCC, Tensor) vs Standard NFT (ME) |
| `l2-router.js` | L2-роутинг: tps=low→MagicBlock ER (gasless, REPLA L3), tps=high→Sonic HyperGrid; ux=private→Arcium+PST |
| `control-panels-v3.js` | **19 control panels** (view/act контролы по доменам) |
| `handoff-v3.js` | handoff-v3 протокол (idempotent handoffId, retry×5) + final report **20 пунктов** |
| `server.js` | zero-dep HTTP API (GET only, CORS, bind 0.0.0.0:8787) |
| `smoke-devnet.js` | runtime smoke: все endpoints «API проверки» + advisory devnet RPC probe |
| `sql/cross_game_materials.sql` | RLS `tenant_id = 'aof'` + `mv_cross_game_materials_aof` |
| `tests/os-v3.test.js` | node:test suite |

## 19 control panels

1. identity-session-keys · 2. assets-cnft · 3. core-attributes-growth ·
4. storage-xandeum · 5. privacy-pst-arcium · 6. indexer-laserstream ·
7. indexer-shyft · 8. indexer-postgres · 9. l2-sonic-hypergrid · 10. l2-magicblock ·
11. analytics-helika · 12. analytics-gamesight · 13. analytics-game-signals ·
14. marketplace · 15. gamba-gamble · 16. tournaments-arenas · 17. monetization ·
18. security-testing · 19. infra-ecs-depin

Каждая панель привязана к компонентам стека (`components: [id]`) и к API-endpoints.

## handoff-v3

- **cross-game**: PDA `studio_profile`, ARC Entity IDs, Bolt entity IDs, linked
  wallets RACE + idosgames bridge, материалы (ARC Entity-Component + Core Attributes
  + Xandeum, RLS tenant_id aof, mv_cross_game_materials_aof);
- **agents/engines**: Husks, RitArena, relayzero, StealthSDK, Unity, Godot;
- **протокол**: `handoffId = sha256(gameId|from|to|payloadHash)`, retry ×5 с
  exponential backoff (семантика RitArena lifecycle events);
- **final report**: ровно 20 пунктов (`GET /api/os/final-report`, `FINAL_REPORT_V3.md`).

## Слои клиентов (Unity/Godot)

v1 — 7 layers: Platform, Identity, Chain, Assets, Economy, Data, Ops.
v2 — 12 products: farming, crafting, trading, marketplace, inventory,
golden-tools-land, session-wallet, tournaments, crop-fighters, craft-gamble,
workers-depin, cross-game-materials.
v3 — 13 best-free SDK: gamba, preset, ritarena, xandeum, pst, core-attributes,
access-protocol, idosgames-wallet, security-auditing-skill, sentio-cli, solguard,
solana-slam, arcium.
См. `game/README.md`.

## Rust Actix gateway (stage prototype)

`src/os/actix-gateway/` — каркас high-performance шлюза (тот же контракт API),
альтернатива Node-серверу для продакшн-прогона; на stage/prototype канонический
сервер — `src/os/server.js` (zero-dep, покрыт smoke).

## Запуск и проверка

```bash
cd src/os
npm start            # http://0.0.0.0:8787
npm test             # node:test — 33/19/20 инварианты, все API-проверки
npm run smoke        # runtime smoke devnet (endpoints + advisory RPC probe)
npm run smoke:offline
```
