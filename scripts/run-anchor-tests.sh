#!/usr/bin/env bash
set -euo pipefail

mocha=(npx tsx node_modules/mocha/bin/mocha.js -t 1000000)

if [[ "${AOF_VRF_EXPIRY_ONLY:-0}" == "1" ]]; then
  exec "${mocha[@]}" --grep "pack timeout refund" tests/aof_vrf_localnet.ts
fi

exec "${mocha[@]}" \
  tests/aof_core.ts \
  tests/aof_payer_funding.ts \
  tests/aof_tool_ownership.ts \
  tests/aof_extended.ts \
  tests/aof_market.ts \
  tests/aof_vrf_localnet.ts \
  tests/aof_cu_report.ts
