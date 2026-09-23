# Custody / migration release gate (c-09…c-12)

**Status: design/runbook only, NOT deployed custody.** No upgrade, authority transfer,
funding, minting or proposal apply was performed in this change. Do not enable
session spending, rebirth or market placement to demonstrate readiness.

## Required evidence before release

1. Assign named security, economy and operations owners. Review all six IDs in
   `watchtower/addresses.json` on the intended cluster. Public RPC executable status
   alone does not prove matching bytecode, upgrade authority or timelock.
2. Produce reproducible SBF artifacts, generated IDLs, hashes and SBOM at the release
   commit. Run `scripts/check-idl-drift.py --target-idl target/idl`, then
   `scripts/verify-programs.sh devnet <expected-authority> target/deploy` from a
   trusted environment. Record ProgramData, upgrade authority, slot and tx signatures.
3. Adopt a reviewed multisig (proposed policy: 2-of-3 independently held keys), plus
   a program-enforced upgrade timelock (proposed minimum: 48 hours). These are policy
   proposals, not deployed parameters. Verify threshold, members and executable
   delay on-chain; a UI countdown or backend 2FA is not equivalent to a timelock.
4. Transfer *upgrade authority* only after the governance executor can upgrade a
   canary in a drill. Configure each program's *application authority* separately:
   two-step authority rotation is not upgrade custody. Keep operational reward
   signing separate and constrained by issuance/supply caps and receipts.
5. Emergency pause may bypass an upgrade delay only through an explicitly approved
   guardian policy. Unpause, cap increases, fee changes and compensation must require
   governance approval. Verify pause reachability for each program; LP currently
   has a paused config field but no demonstrated deployed emergency-pause procedure.

## Proposal transaction lifecycle (not implemented here)

Hub submits an expiring, nonce-bound signed proposal with game/program IDs, expected
config hash, bounded arguments and rollback policy. Game operators authenticate
with RBAC + 2FA; distinct approvers authorize the exact message. Multisig/timelock
executes the approved transaction. Both hub and game append immutable proposal ID,
message hash, signer identities, tx signature, finalized slot and before/after state.
Replay, stale config, expiry, same-person double approval and bypass of timelock must
fail. Read-only Watchtower exporter MUST NOT execute this lifecycle or load keys.

Apply to fees, pause/unpause, issuance caps and marketplace config. Rollback is a
new approved compensating action with its own budget, not deletion of audit logs.
Neither a completed trade nor a mint can be undone by merely rolling back a binary.

## State migration / versioning

- Record old/new program version, exact account layout, IDL hash and state version.
  Do not add fields to serialized accounts without a migration plan.
- This patch changes the disabled SessionCreate allocation from 130 to 146 bytes
  (account discriminator included), and SessionCheckAndSpend requires owner co-sign.
  It does NOT enlarge previously allocated accounts. Inventory existing account
  lengths first; audit a separate authority-bound migration if old accounts exist.
  Session spending remains unavailable; do not advertise popup-free automation.
- Snapshot finalized account state and database checkpoint; test restore and replay
  into an isolated database. Verify balances, receipt uniqueness and issuance caps.
- Stage the upgrade with a canary, preserve old artifacts and state snapshots, and
  reconcile events → ledger → balances before lifting a pause. A schema-changing
  upgrade may make binary rollback unsafe; rehearse forward repair as well.
- Define rollback triggers: unknown mint deltas, duplicate claim, unexplained vault
  deficit, cursor gap or excessive finalized lag. Stop issuance immediately through
  the existing cap/pause governance path; never compensate by uncapped minting.

## RLS migration operations

`src/os/sql/cross_game_materials.sql` requires PostgreSQL 15+, a migration admin and
exclusive deployment coordination (it recreates the cached view). Grant
`aof_materials_reader` ONLY to the AOF exporter login and `aof_materials_writer`
ONLY to the AOF projector login. Both must be NOSUPERUSER/NOBYPASSRLS; never share
these credentials with other games. Set `app.tenant='aof'` transaction-locally on
pooled base-table queries. Missing/wrong tenant denies access.

The materialized view is a cached AOF roster and does not evaluate base RLS when
read. It is protected by role grants, not `app.tenant`. Refresh through its trusted
owner, with `app.tenant='aof'`; the ordinary exporter has SELECT only. Audit existing
role memberships/extra policies before migration. PostgreSQL admins/BYPASSRLS
roles remain privileged by design. The migration grants no production logins.
