---
name: security-auditing
description: Systematic security audit skill for AOF (game_id aof) — Solana program, backend, and Unity/Godot client review covering co-sign flows, session keys, PDA seeds, RLS, idempotency and marketplace/gamble paths. Best free security skill of the AOF v3 stack (with Sentio + SolGuard).
---

# Security Auditing Skill (AOF v3)

Systematic audit procedure for **NeuroForge** (ex-Age of Farming; tenant `aof`, network `stage`
/ `prototype`, program_ids `AOF_CORE_PROGRAM_ID`, `CgInv111...`, `SessKeys111...`,
`STrEaSuRy111...`). Pair with **Sentio CLI** (tracing) and **SolGuard** (130+
static checks; chosen over SolShield). Run order: this skill → sentio-cli → solguard
→ solana-slam (LiteSVM) → preset e2e.

## 1. Identity & Session Keys

- [ ] `createSession` binds only `AOF_CORE_PROGRAM_ID` instruction allow-list;
- [ ] `FORBIDDEN_IXS_MASK` physically excludes `withdraw`, `transfer`, `payout`;
- [ ] topUp ≤ 0.01 SOL, hard expiry 60 min, no renewal-with-escalation path;
- [ ] Privy guest/embedded wallets: gas sponsorship spend-capped per tenant `aof`;
- [ ] cross-game wallet link (RACE / idosgames) requires explicit user signature.

## 2. Assets & Storage

- [ ] cNFT mint authority = Bubblegum tree authority; MCC verified before listing;
- [ ] Standard NFT (golden tools, land) provenance + Core Attributes immutable keys
      (`asset_id`, `is_cnft`, `source_game`) only set at mint;
- [ ] Xandeum pointers are content-addressed; PST proofs verify before accept;
- [ ] RLS `tenant_id = 'aof'` enforced on `cross_game_materials`
      (`src/os/sql/cross_game_materials.sql`); materialized view refreshed
      `CONCURRENTLY` only.

## 3. Programs & Co-sign

- [ ] server never signs blindly: build → client sign → `eventsOf(sig)` verify → submit;
- [ ] PDA seeds reviewed (`config`, `player`, `vault`, `issuance_cap`, `studio_profile`);
- [ ] mint CPIs target writable Mints only (mint-writable gate);
- [ ] Gamba: commit-reveal binding (commit hash includes player + nonce), house edge
      exactly 5%, jackpot draw verifiably random, CgInv inventory cannot mint outside
      wager resolution;
- [ ] DePIN: worker stake 10 SOL locked, escrow 0.1 SOL per 100 players, slash only
      with two-phase evidence (Sentio trace + finalized event).

## 4. Infra gates (ARC / Bolt / Access)

- [ ] ARC entities (crop, plot) carry `source_game=aof`, `is_cnft`, `asset_id`;
      systems `harvest`/`craft` mutate only own components (Position, GrowthStage,
      Owner, Item);
- [ ] Bolt FOCG: `plant`/`harvest` deterministic, no wall-clock in state transitions;
- [ ] Access Protocol stake-to-access: golden tools/land drops verify stake before
      reveal; early unstake forfeits access, never refunds mid-gate.

## 5. L2 & Privacy

- [ ] MagicBlock `executeGasless` scoped to auto-harvest only; `commit_state` replay-protected;
- [ ] REPLA L3 settlement cannot reorder finalized L2 commits;
- [ ] Arcium circuits leak nothing outside the confidential computation;
      PST openings single-use.

## 6. Backend & Ops

- [ ] idempotency keys on every write route; gap backfill + finalized reconciliation on;
- [ ] admin tokens split (operator vs read-only), ≥ 32 chars, audit-logged;
- [ ] Watchtower exporter stays read-only, GET-only, signer-free;
- [ ] SolGuard report clean at 130+, Sentio alerts routed to the Security control panel
      (panel 18 of `src/os/control-panels-v3.js`).

## Output

Emit findings as `severity | area | evidence | fix`, then re-run
`cd src/os && npm test && npm run smoke` and attach the smoke summary to
`FINAL_REPORT_V3.md`.
