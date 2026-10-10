#!/usr/bin/env bash
# Build frontend/dist for the nginx root. Does not upload or deploy.
# The public bundle gets VITE_* at build time. A mainnet bundle must not
# fall back to the devnet RPC baked into wallet.ts.
#
#   AOF_FRONTEND_ENV=ops/deploy/frontend.env ops/build-static.sh mainnet
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cluster="${1:-}"
env_file="${AOF_FRONTEND_ENV:-$root/ops/deploy/frontend.env}"
refuse() { echo "ops/build-static: $*" >&2; exit 1; }

case "$cluster" in
  mainnet|devnet) ;;
  *) refuse "usage: ops/build-static.sh mainnet|devnet" ;;
esac
[[ -f "$env_file" ]] || refuse "missing $env_file"

if grep -Eq '\$\(|`' "$env_file"; then
  refuse "frontend env must be plain KEY=VALUE lines"
fi

read_value() {
  awk -v key="$1" '
    /^[[:space:]]*#/ { next }
    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      line=$0
      sub(/^[^=]*=[[:space:]]*/, "", line)
      gsub(/^["'\'']|["'\'']$/, "", line)
      gsub(/[[:space:]]+$/, "", line)
      print line
      found=1
      exit
    }
    END { if (!found) exit 2 }
  ' "$env_file"
}

api="$(read_value VITE_API_URL)" || refuse "VITE_API_URL is required"
rpc="$(read_value VITE_RPC_URL)" || refuse "VITE_RPC_URL is required"
domain="$(read_value VITE_WALLET_PROOF_DOMAIN)" || refuse "VITE_WALLET_PROOF_DOMAIN is required"
mining="$(read_value VITE_MINING_ENABLED || true)"

[[ "$api" == "/api" ]] || refuse "this layout uses same-origin /api so nginx strips the prefix once"
[[ "$domain" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || refuse "VITE_WALLET_PROOF_DOMAIN is not a domain token"
[[ "$(printf '%s' "$mining" | tr '[:upper:]' '[:lower:]')" != "true" ]] || refuse "VITE_MINING_ENABLED=true is not part of this deploy"
rpc_lower="$(printf '%s' "$rpc" | tr '[:upper:]' '[:lower:]')"
if [[ "$rpc_lower" == *"@"* || "$rpc_lower" == *"api-key="* || "$rpc_lower" == *"api_key="* ]]; then
  refuse "VITE_RPC_URL is public and must not contain credentials"
fi

case "$cluster" in
  mainnet)
    [[ "$rpc" =~ [Dd]evnet|[Tt]estnet|localhost|127\.0\.0\.1|::1 ]] && refuse "mainnet bundle refuses a devnet, testnet, or local RPC"
    export VITE_CLUSTER=mainnet
    ;;
  devnet)
    [[ "$rpc" =~ [Dd]evnet ]] || refuse "devnet bundle must name a devnet RPC explicitly"
    export VITE_CLUSTER=devnet
    ;;
esac

export VITE_API_URL="$api"
export VITE_RPC_URL="$rpc"
export VITE_WALLET_PROOF_DOMAIN="$domain"
export VITE_MINING_ENABLED=false

if [[ ! -d "$root/frontend/node_modules" ]]; then
  refuse "frontend/node_modules is missing; run npm ci in frontend/ on the build machine"
fi

( cd "$root/frontend" && npm run build:release )

if [[ "$cluster" == "mainnet" ]] && ! grep -R -q -F "$rpc" "$root/frontend/dist"; then
  refuse "configured RPC was not baked into the bundle"
fi
echo "ops/build-static: $cluster bundle is in frontend/dist"
