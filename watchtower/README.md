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
checked by the events test. Summary for `aof-v1`: **24 native** (from a
concrete on-chain event, incl. `PausedToggled`/`EmergencyPause` and
`ConfigUpdated` for fees / resource mints / craft economy — these Anchor
events ship with the next program upgrade), **11 derived** (computed from the
ledger: PlayerJoined/FirstAction/RetentionDayN, FraudSignalCreated, indexer
gaps), **15 unsupported** with a reason each — e.g. no sessions/matches/races
in a farming game, no authority-transfer instruction (`AuthorityChanged`) and
no Squads yet so no `AdminProposal*`.

Every event in the three IDLs is either mapped or explicitly listed as ignored
in `event-normalizer.ts`; the events test fails if a new IDL event appears
without a decision.

## Run

```bash
# dev (uses aof_backend's node_modules / Prisma client / .env)
cd watchtower && cp config.example.env .env && npm run dev   # resolves packages via NODE_PATH=../aof_backend/node_modules
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

## 2026-09-23 evidence corrections

- The static manifest is now `dataQuality: unavailable`, not a deployment assertion.
  `addresses.json` is the six-program reference registry; CgInv/STrEaSuRy are null
  placeholders, never indexer subscriptions. Only three programs are currently indexed.
- All 14 routes remain read-only. JSON data envelopes expose `writes:false` and
  `dataQualityByDomain` for players/economy/craft/market/security. Mock mode is not
  readiness; missing, errored or >10-minute-old expected cursors fail coverage closed.
  Domain quality remains at most partial until the listed limitations are resolved.
- `PlayerJoined` is **unavailable as an event**: first-seen cohorts are not a durable
  joined-event emitter. `WalletConnected` is unavailable too; referral binding does
  not prove a client connected its wallet. Earlier text describing these as emitted
  derived/native events is superseded. See the catalog's reason on every unavailable
  required farming event. Supported mapping fixtures are not devnet evidence.
- The invalid ReferralBound → WalletConnected output is removed. The subsequent
  LiabilityCreated keeps ordinal `:1` to preserve existing IDs. Existing consumers
  must invalidate historical WalletConnected rows whose source is ReferralBound
  and rebuild connection metrics; replay alone will not delete these old rows.
  Do not reassign the removed `:0` IDs to a different event.
- Failed-transaction logs cannot become finalized economic effects. Crowded-slot
  cursor pagination now includes the signature tie-break; empty filtered source
  transactions also advance the cursor. Event fan-out is atomic (a page can exceed
  its soft limit to avoid splitting one source row).
- `test:quality` checks route registration and coverage logic, **not 14 live endpoint
  acceptances**. Hub accepted/duplicate acceptance and authenticated ingestion remain
  blocked until a real deployment/RPC is available. See `reports/AOF_READINESS.md`.

## Issuance accounting (partial b-09)

`/watchtower/economy` now includes `data.issuanceJournal`: per-mint double-entry
ResourceIssued flow postings reconciled against the indexer's transaction mint
deltas. Read-only, latest 200 complete transactions, deterministic rebuild and
replay conflict checks. Missing/mismatched/invalid sources do not create postings.
No wallet balances are invented (`walletBalances:null`); full economy coverage
remains partial/unavailable. See `docs/AOF_ECONOMIC_INVARIANTS.md` for limitations,
privacy, tests and interpretation of negative issuance source counters.
