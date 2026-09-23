# Economic invariants and issuance journal (c-07 / partial b-09)

## On-chain boundaries

`aof-core/src/economics.rs` is called by instruction handlers, not a separate
simulator. No instructions, account fields, PDA seeds or IDL ABI changed here.

| Primitive | Real call sites | Invariant |
|---|---|---|
| `split_bps` | marketplace, auction, lottery ticket, offer, craft order, resource mint | `net + fee = gross`; floor rounding; reject bps > 10000; u128 intermediate supports u64::MAX |
| `linear_cost` | all six resource costs in `craft` | exact `base + minted * multiplier`, checked u64 conversion; no wrapped/negative cost |
| `payout_balances` / `transfer_owned_lamports` | auction refund/settlement, offer accept/cancel, craft-order fulfill/cancel, forge expiry/reveal, lottery prize | full liability or error; no spend below reserve/rent; checked recipient addition; sum unchanged |
| `settle_prize` | lottery claim handler | drawn + unclaimed + winning ticket + funded full prize; only then consume `claimed` |

Transfer helper rejects foreign-owned sources, readonly accounts and source ==
recipient. It acquires both mutable balance borrows and validates arithmetic
before writing either side. Repeated recipient addresses (seller == treasury)
are handled by sequential credits, not two writes based on a stale old balance.
A multi-step instruction still relies on Solana transaction rollback if a later
CPI or account-exit check fails.

Previously lottery used `min(pool_lamports, available_above_rent)` and marked the
round claimed even when paying less than its recorded liability. It now returns
`VaultInsufficient` without consuming the claim. This does not establish whether
any live deployment had such an underfunded round: RPC is not verified.

The resource budget, receipt namespace, issuance and supply caps are unchanged.
Lottery sales/draw, forge commit/reveal, session spending and rebirth remain
fail-closed. A property test passing is NOT permission to enable those mechanics.

## Tests and what they do NOT prove

- Host Rust: 20k fee inputs × 6 rates; 20k progressive cost cases; 30k transfer
  balance/reserve cases. All use real handler helpers and include zero/MAX edges.
- Host account tests: alias/ownership/borrow rejection, unchanged balances on
  rejection, shared recipient; lottery underfunding, wrong ticket, not-drawn,
  recipient overflow, zero prize and 100 rejected repeat claims.
- Local-validator suite: recipe #3 exact SPL supply/ATA deltas; failure on second
  input and on output cap after input burns must roll back; exact output cap
  succeeds. Marketplace exact seller/buyer deltas and executed treasury transfer account
  for rent; treasury is checked from parsed CPI to avoid >2^53 balance rounding; distinct-message replay cannot settle again. Auction refund
  returns exact old bid, including self-outbidding, preserving rent + new bid.
- Existing local-validator receipt tests cover two concurrent signed messages
  for one recipient/reward ID: exactly one mint, and per-recipient namespace.

Not proven: economic market value of one tool vs six resources, all eight recipe
combinations, VRF fairness, every legacy forge/lottery account state in SVM, total
protocol solvency or lossless replay of an independently verified devnet history.
A burn/mint transformation conserves quantities according to its recipe; it does
not conserve monetary value without an explicit pricing model.

## Read-only double-entry issuance report

`GET /watchtower/economy` adds `data.issuanceJournal`. It reads the **latest 200
complete transactions** in the requested window from the existing indexer tables.
A 201st row sets `truncated:true`. A transaction's event collection is never cut
mid-transaction. There is no new route and no write/signing capability.

For each valid `ResourceIssued` from the registry's core program:

```
asset = mint (atomic units, no floating-point conversion)
source:issuance       -gross
player:<salted hash>  +(gross - fee)
treasury:unattributed +fee
sum                    0
```

`treasury:unattributed` is a role/counter, NOT a guessed historical wallet. The
source event does not prove that address. Postings are signed flow movements;
a negative source counter is not a negative player token balance.

The projector validates canonical u64 strings, fee <= gross, minted-in-epoch <=
cap, slot relation, source program, successful parent transaction/event and event
identity. It aggregates ALL issuance events for a (signature, mint), then compares
their gross sum with that transaction's indexed SPL net delta. A missing/different
observation quarantines that mint group; no balancing adjustments are invented.
An additional burn or unrelated mint in the same tx can legitimately cause a
mismatch — this is an investigation signal, not an automatic fraud verdict.

Supported states: `matched`, `mismatch`, `missing_observation`, `unmapped`.
Malformed/untrusted or conflicting duplicate sources appear in `rejected`.
Byte-equivalent/canonical duplicate transactions cannot double the projection;
conflicting replays invalidate both versions, independent of input order.
Storage row IDs and JSON property ordering do not change logical identity.

### Explicit limitations

- Always at most `dataQuality: partial`; no matched source => `unavailable`.
- `walletBalances` and `openingBalances` are **null**, never fabricated zeros.
- A shared player hash salt is required; missing salt disables postings.
- Raw wallet identities never leave the report. Signatures/mints remain public
  provenance, following the existing exporter contract.
- No cross-asset summation: every balance movement/reconciliation is per mint.
- This is a deterministically rebuilt **flow projection** of the durable indexer
  source, not an independent append-only ledger or an on-chain wallet snapshot.
- Indexer rows are trusted as finalized by its existing ingestion contract; this
  function does not RPC-verify signatures/finality, receipt ownership or bytecode.
- Craft/burn/trade/auction/lottery postings and historical treasury attribution are
  not implemented. Sink/source ratio and velocity for the full game are NOT inferred
  from the issuance-only sample. Do not use it as a complete payout authorization.

## Rebuild / verification

```
npm test --prefix watchtower
npm run typecheck --prefix watchtower
python3 scripts/check-idl-drift.py
cargo test --locked --workspace --lib
anchor test                              # disposable local-validator environment
cd aof_backend && npm run test:idempotency-db
# PG mode: dedicated CI/test database ONLY, never a production connection:
# IDEMPOTENCY_TEST_DATABASE_URL=<test DB> npm run test:idempotency-db:pg
```

The backend's existing disposable SQLite/PostgreSQL runner additionally tests the
real journal SELECT path: rebuild equality, no writes, atomic rollback of a failed
ingestion transaction and quarantine on event↔delta mismatch. It seeds synthetic
fixtures and deletes only those fixtures afterwards. It is NOT hub/devnet acceptance.
