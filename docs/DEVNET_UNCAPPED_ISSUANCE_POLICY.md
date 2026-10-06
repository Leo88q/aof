# Devnet policy: intentionally uncapped lifetime issuance

**Decision scope:** Devnet only. This policy leaves the on-chain lifetime sentinel at `u64::MAX`; it does not call `issuance:lifetime-caps:apply` and does not alter any on-chain account. The cumulative `lifetime_minted` counter continues to increase for audit, but `u64::MAX` means the program does not stop issuance at a finite total.

## Explicit opt-in

The mining preflight blocks an unlimited lifetime cap by default. From `aof_backend/`, if the Devnet operator intentionally accepts uncapped cumulative issuance, persist the read-only report locally:

```sh
mkdir -p "$HOME/.aof"
ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 \
MINING_PREFLIGHT_REPORT="$HOME/.aof/mining-devnet-preflight.json" \
npm run preflight:mining-devnet
```

The report records `lifetimeIssuancePolicy.mode = "unlimited-devnet-accepted"` and each affected resource as `capMode = "unlimited-devnet-accepted"`. It reports `remainingLifetimeAtoms = "unlimited"` for those entries. The flag only records a policy choice; it neither sets the mining switch nor changes the cap. Wrong-genesis checks, history reconciliation, mint validation, registry status checks, and all other blockers remain in force.

After the independent bytecode/smoke and registry-signoff gates, use that exact clean report for the mining-enable dry-run:

```sh
MINING_PREFLIGHT_REPORT="$HOME/.aof/mining-devnet-preflight.json" \
ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet \
  BASE_URL="$BACKEND_URL" ADMIN_TOKEN="$ADMIN_TOKEN" \
  scripts/enable-mining-devnet.sh
```

Only after a successful, separately performed Devnet smoke, repeat with `MINING_SMOKE_OK=1` and `--apply`. The script checks that the supplied report is for Devnet, has no blockers, and records the uncapped policy acknowledgement. The smoke acknowledgement remains an operator attestation; it does not inspect or generate smoke evidence. For the uncapped path, `scripts/devnet-bringup.sh` also requires `SKIP=lifetime-caps`, so it cannot apply any finite cap. Its broad `--apply` requires `MINING_SMOKE_OK=1` before making writes if mining is not skipped; use `SKIP=mining` for the config-only phase, then run the separately gated mining enable after smoke and registry sign-off. Never set `AOF_ENABLE_TARGET` to anything other than `devnet`; this flag is not a mainnet authorization. Keep the API token, authority key, and RPC URL local.

## What the current code charges

- `start_mining` reserves one available villager and starts a timed session. `collect_mining` decrements tool durability and mints the reward. The mining instruction does **not** burn a resource token or charge an in-game fee proportional to the reward. The player pays ordinary Solana transaction fees (and may pay account rent when an ATA is first created).
- Exploration escrows and burns its configured resource inputs at settlement; that is an actual token sink. Other mechanics have their own gates and costs. These mechanisms do not prove that the market value of all costs equals the value of all rewards.
- All 27 `IssuanceCap` accounts currently have `capPerEpoch = 1_000_000_000_000` raw atoms and `epochSlots = 216_000`. In current code, `charge_epoch` is used by direct `mint_resource`; the mining and other reward paths use the cumulative `max_supply` check instead. With `max_supply = u64::MAX`, they therefore have no finite lifetime ceiling and do not share that direct-mint epoch budget.

This is an accepted Devnet game-economy choice, not a claim that issuance is fully collateralized or price-stable. The operational risk is runaway resource growth, dilution, or activity concentrated in multiple tools/wallets; the 25-wallet model is not enforced by the program. Review supply deltas, player sinks, and demand during a controlled pilot. This Devnet decision does not authorize mainnet issuance or spending real AR.
