#!/usr/bin/env bash
# Repo-side checks for the VPS layout. Does not read secrets, start Docker, or deploy.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
fail() { echo "ops/preflight: $*" >&2; exit 1; }

for script in ops/up.sh ops/build-static.sh ops/nginx/install.sh ops/nginx/refresh-cloudflare-ips.sh ops/nginx/lock-origin.sh scripts/backup-offsite.sh scripts/backup-db.sh; do
  bash -n "$script" || fail "$script has a syntax error"
  [[ -x "$script" ]] || fail "$script is not executable"
done

grep -q '127.0.0.1:8080' ops/nginx/aof.conf.example || fail "nginx example lost the loopback API"
if grep -Eq '^[[:space:]]*listen[[:space:]]+8080([^0-9]|$)' ops/nginx/aof.conf.example; then
  fail "nginx example listens on the API port"
fi
grep -q 'vrf_settler_secret_key' docker-compose.vps.yml || fail "VPS overlay lost the settler wallet"
if grep -q 'authority_secret_key' docker-compose.vps.yml; then
  fail "VPS overlay must not name the operator key file"
fi
grep -q 'VITE_RPC_URL is required in a production bundle' frontend/src/lib/wallet.ts || fail "production bundle can still omit the RPC"
grep -q 'must not contain credentials' frontend/vite.config.ts || fail "a keyed public RPC can still be baked into the bundle"
grep -q 'unset COMPOSE_FILE COMPOSE_PROFILES' ops/up.sh || fail "compose can still inherit a secrets overlay from the shell"
grep -q 'backup-offsite.sh' scripts/backup-db.sh || fail "backup does not call the offsite uploader"
grep -q 'AOF_SKR_CRAFT=live' docs/VPS_CLOUDFLARE_LAYOUT.md || fail "layout doc lost the closed-flag warning"

echo "ops/preflight: repo side ready for a later VPS bring-up (no box was started)"
