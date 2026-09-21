# AOF → Watchtower integration

Read-only exporter that lets Watchtower observe **Age of Farming** (Solana:
`aof_core`, `aof_market`, `aof_quests`) per `docs/GAME_REPO_DELIVERABLES.md`
of the Watchtower repository. `gameId = aof`, `parserVersion = aof-v1`.

```
watchtower/
├── README.md                      this file
├── config.example.env             every WATCHTOWER_* variable, no secrets
├── integration-manifest.json      programs, PDAs, parser/data-quality declaration
├── Dockerfile                     image (context = repo root)
├── events/
│   ├── schema.json                JSON Schema of one exported event
│   ├── event-types.json           all 50 Watchtower types × native | derived | unsupported
│   └── fixtures/                  ChainEvent/ChainTx inputs + expected normalized output
├── src/
│   ├── watchtower-exporter.ts     HTTP server, auth, envelopes (GET only)
│   ├── event-normalizer.ts        AOF event → Watchtower event (pure)
│   ├── event-decoder.ts           IDL log decoder (re-export) + schema validator
│   ├── read-model.ts              SELECT-only queries over the indexer ledger
│   ├── health.ts                  /health, /readyz, finalized lag
│   └── metrics.ts                 prom-client; optional Sentry / OTel / Redis
├── migrations/watchtower-read-model.sql   indexes + views over the ledger
└── tests/
    ├── watchtower-events.test.ts   mapping, fan-out, hashing, catalog sync
    ├── watchtower-decoder.test.ts  raw Anchor logs → normalized, through the committed IDLs
    ├── watchtower-replay.test.ts   determinism, stable ids, cursor round-trip, idempotent replay
    └── watchtower-readonly.test.ts no Prisma writes, no signer, RPC = getSlot only, GET only
```

## How it gets data

The exporter does **not** index the chain itself. `aof_backend/services/chain-indexer`
already keeps a finalized-only ledger (`ChainTx`, `ChainEvent`, `ChainMintDelta`,
`IndexerCursor`) with forward sync + historical backfill, deduplicated by
`(signature, eventIndex)`. The exporter reads that database (same
`DATABASE_URL`, or `WATCHTOWER_DATABASE_URL` pointing at a read replica) and
normalizes on the fly. Consequences:

* **commitment** is always `finalized`; `finalizedLag` = chain finalized slot
  (the only RPC call the exporter makes) − newest indexed slot;
* **backfill / replay**: `/watchtower/events?sinceSlot=0` streams the whole
  ledger in `(slot, signature, eventIndex)` order; `cursor` resumes exactly;
  `eventId = signature:eventIndex:n` is stable, so re-processing is idempotent;
* **dataQuality** is computed, never asserted: `complete` only when
  `IndexerCursor.backfillComplete` holds for all three programs (or the ledger
  provably covers the requested window), `partial` while backfilling,
  `unavailable` when the indexer has not run. An empty ledger is reported as
  `unavailable`, not as zeros.

## Boundaries

| Rule | Enforcement |
|---|---|
| no signer | first line of the process deletes `AUTHORITY_SECRET_KEY` from `process.env`; the readonly test asserts no signer/tx-submission symbols exist in `src/` |
| no writes | there is no write code path; `WATCHTOWER_ENABLE_WRITES=true` makes the process refuse to start; readonly test greps for Prisma mutations |
| GET only | any other method → 405 |
| no raw wallets | `playerId = sha256(WATCHTOWER_PLAYER_HASH_SALT \| wallet)`; attribute values equal to a wallet field are scrubbed; events test asserts no fixture wallet appears in output |
| RPC surface | `getSlot("finalized")` only (asserted) |
| no enforcement | fraud cases are exported as `FraudSignalCreated` / `PlayerQuarantined` (human-confirmed review) — AOF never auto-bans, and the exporter cannot change that either way |

## Endpoints (`Authorization: Bearer $WATCHTOWER_EXPORTER_TOKEN`, except `/health`)

| Endpoint | Content | dataQuality |
|---|---|---|
| `GET /watchtower/health` | liveness; declares `writes:false, signerCapability:false` | — |
| `GET /watchtower/readyz` | DB, indexer cursor freshness, RPC; 503 when not ready (`mock` provider tolerates an empty ledger) | — |
| `GET /watchtower/config` | manifest + live coverage + supported/derived/unsupported event types | live |
| `GET /watchtower/events?sinceSlot=&cursor=&limit=&types=&includeTx=` | normalized stream, forward-only, schema-validated before send | coverage |
| `GET /watchtower/metrics/daily?days=` | tx ok/failed, unique payers, active players, events by type/category | window |
| `GET /watchtower/players/cohorts?weeks=` | new players per ISO week (first on-chain event) | derived |
| `GET /watchtower/players/retention` | D1/3/7/14/30 with eligible/retained counts | derived |
| `GET /watchtower/players/cross-game?limit=` | hashed roster + firstSeen for cross-game joins (`unavailable` without the shared salt) | derived |
| `GET /watchtower/economy?days=` | per-mint minted/burned/net + daily, latest EconomySnapshot with its own fieldQuality | window |
| `GET /watchtower/treasury?days=` | issuance fees by kind, gas sweeps, vault payouts (flows, not balances) | window |
| `GET /watchtower/security?days=` | on-chain config changes (incl. issuance-cap halts), admin actions from AuditLog, fraud-case summary, multisig status | live |
| `GET /watchtower/alerts?days=` | open + recently resolved review cases (hashed) | derived |
| `GET /watchtower/funnels?days=` | onboarding and monetization step counts | window |
| `GET /watchtower/metrics` | Prometheus text format | — |

Every JSON response (except health/readyz/config/metrics) is wrapped:

```json
{ "gameId":"aof", "network":"devnet", "parserVersion":"aof-v1", "generatedAt":"…",
  "commitment":"finalized", "finalizedLag":{…}, "dataQuality":"partial", "confidence":"finalized|derived",
  "window":{…}, "data":… }
```

## Event coverage

`events/event-types.json` is generated from the normalizer's support tables and
checked by the events test. Summary for `aof-v1`: **22 native** (from a
concrete on-chain event), **11 derived** (computed from the ledger:
PlayerJoined/FirstAction/RetentionDayN, FraudSignalCreated, indexer gaps),
**17 unsupported** with a reason each — e.g. no sessions/matches/races in a
farming game, `set_paused`/`set_authority` emit no Anchor event today
(Watchtower should diff the `config` account), no Squads yet so no
`AdminProposal*`.

Every event in the three IDLs is either mapped or explicitly listed as ignored
in `event-normalizer.ts`; the events test fails if a new IDL event appears
without a decision.

## Run

```bash
# dev (uses aof_backend's node_modules / Prisma client / .env)
cd watchtower && cp config.example.env .env && npm run dev
# tests
npm test                      # or: cd aof_backend && npm run test:watchtower
# production
docker compose -f docker-compose.prod.yml --profile indexer up -d watchtower-exporter
```

`WATCHTOWER_EVENT_PROVIDER=indexer` in production: `/readyz` then requires a
fresh `IndexerCursor` (`WATCHTOWER_STALE_CURSOR_MS`, default 10 min).

## Verification checklist before setting `lastVerifiedAt`

1. chain-indexer running, `backfillComplete: true` for all three programs;
2. `GET /watchtower/config` → `dataQuality: complete`, `saltConfigured: true`;
3. `GET /watchtower/events?sinceSlot=0&limit=500` replayed twice → identical `eventId` set;
4. `finalizedLag.lagSlots` small and stable, `rpc: primary`;
5. Watchtower's own contract tests pass against the exporter; then set
   `lastVerifiedAt` and `dataQuality` in `integration-manifest.json`.
