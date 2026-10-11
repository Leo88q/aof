#!/usr/bin/env bash
# Start the product VPS stack: API + vrf-settler, read-only authority, fee wallet only.
# Does not deploy programs, buy a box, open SKR mechanics, or set a randomness flag.
#
#   ops/up.sh --check     # validate files, do not start containers
#   ops/up.sh --apply     # on the VPS, after ops/deploy/release.sha matches HEAD
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

apply=0
case "${1:-}" in
  --check|"") apply=0 ;;
  --apply) apply=1 ;;
  -h|--help)
    echo "usage: ops/up.sh [--check|--apply]"
    exit 0
    ;;
  *) echo "ops/up: unknown argument (use --check or --apply)" >&2; exit 2 ;;
esac

env_file="${AOF_ENV_FILE:-$root/aof_backend/.env}"
secrets_dir="${AOF_SECRETS_DIR:-$root/secrets}"
refuse() { echo "ops/up: $*" >&2; exit 1; }

[[ -f "$env_file" ]] || refuse "missing $env_file"
[[ -f "$root/docker-compose.prod.yml" && -f "$root/docker-compose.vps.yml" ]] || refuse "compose files missing"

# First assignment wins, matching dotenv. Full-line comments are ignored.
# Prints the value, or exits 2 when the key is absent.
read_key() {
  python3 - "$1" "$env_file" << 'PY'
import sys
key, path = sys.argv[1], sys.argv[2]
found = None
for raw in open(path, encoding="utf-8"):
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    if line.startswith("export "):
        line = line[len("export "):].strip()
    if "=" not in line:
        continue
    name, value = line.split("=", 1)
    if name.strip() != key:
        continue
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    elif " #" in value:
        value = value.split(" #", 1)[0].rstrip()
    found = value
    break
if found is None:
    sys.exit(2)
sys.stdout.write(found)
PY
}

has_key() {
  read_key "$1" >/dev/null 2>&1
}

if has_key AOF_SKR_CRAFT && [[ "$(read_key AOF_SKR_CRAFT | tr '[:upper:]' '[:lower:]')" == "live" ]]; then
  refuse "AOF_SKR_CRAFT=live is closed; this layout does not open it"
fi
if has_key AOF_RANDOMNESS; then
  refuse "AOF_RANDOMNESS must stay unset"
fi
if has_key ALLOW_HOT_AUTHORITY_KEY && [[ "$(read_key ALLOW_HOT_AUTHORITY_KEY)" == "1" ]]; then
  refuse "ALLOW_HOT_AUTHORITY_KEY=1 does not belong on the product VPS"
fi
if has_key AUTHORITY_SECRET_KEY || has_key AUTHORITY_SECRET_KEY_FILE; then
  refuse "operator key must not be in the env file"
fi
if has_key AOF_PROCESS_ROLE; then
  refuse "AOF_PROCESS_ROLE is set by compose, not by the env file"
fi
if has_key MINING_ENABLED && [[ "$(read_key MINING_ENABLED | tr '[:upper:]' '[:lower:]')" == "true" ]]; then
  refuse "MINING_ENABLED=true is not part of this deploy"
fi

cluster="$(read_key AOF_CLUSTER | tr '[:upper:]' '[:lower:]')" || refuse "AOF_CLUSTER must be mainnet or devnet"
case "$cluster" in
  mainnet|devnet) ;;
  *) refuse "AOF_CLUSTER must be mainnet or devnet" ;;
esac

rpc="$(read_key RPC_URL)" || refuse "RPC_URL is required"
[[ -n "$rpc" ]] || refuse "RPC_URL is empty"
if [[ "$cluster" == "mainnet" && "$rpc" =~ [Dd]evnet|[Tt]estnet|localhost|127\.0\.0\.1|::1 ]]; then
  refuse "mainnet RPC_URL must not be devnet, testnet, or local"
fi
if [[ "$cluster" == "devnet" && ! "$rpc" =~ [Dd]evnet ]]; then
  refuse "devnet box must not point RPC_URL at another cluster"
fi

cors="$(read_key CORS_ORIGIN)" || refuse "CORS_ORIGIN is required"
python3 - "$cors" << 'PY' || refuse "every CORS_ORIGIN entry must be an https origin without a trailing slash"
import sys
origins = [part.strip() for part in sys.argv[1].split(",") if part.strip()]
if not origins:
    sys.exit(1)
for origin in origins:
    if not origin.startswith("https://") or origin.endswith("/") or " " in origin:
        sys.exit(1)
PY

domain="$(read_key WALLET_PROOF_DOMAIN)" || refuse "WALLET_PROOF_DOMAIN is required"
[[ "$domain" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || refuse "WALLET_PROOF_DOMAIN must match the frontend build"

for required in AUTHORITY_PUBKEY PROGRAM_ID EXPECTED_GENESIS_HASH TREASURY_PUBKEY; do
  value="$(read_key "$required")" || refuse "$required is required"
  [[ -n "$value" ]] || refuse "$required is empty"
done

token="$(read_key ADMIN_TOKEN)" || refuse "ADMIN_TOKEN is required"
[[ "${#token}" -ge 32 ]] || refuse "ADMIN_TOKEN must be at least 32 characters"
if has_key ADMIN_READ_TOKEN; then
  read_token="$(read_key ADMIN_READ_TOKEN)"
  if [[ -n "$read_token" ]]; then
    [[ "${#read_token}" -ge 32 ]] || refuse "ADMIN_READ_TOKEN must be at least 32 characters"
    [[ "$read_token" != "$token" ]] || refuse "ADMIN_READ_TOKEN must differ from ADMIN_TOKEN"
  fi
fi

if has_key DATABASE_URL && [[ "$(read_key DATABASE_URL)" == *postgres* ]]; then
  refuse "this layout stays on SQLite; do not set a Postgres DATABASE_URL"
fi

key="$secrets_dir/vrf_settler_secret_key"
[[ -f "$key" ]] || refuse "missing $key (solana-keygen new, chmod 600, fund the fee wallet)"
[[ ! -L "$key" ]] || refuse "settler key must be a regular file, not a symlink"
[[ -s "$key" ]] || refuse "settler key file is empty"
mode="$(stat -c %a "$key")"
case "$mode" in
  600|400) ;;
  *) refuse "settler key mode is $mode; want 600" ;;
esac
dir_mode="$(stat -c %a "$(dirname "$key")")"
case "$dir_mode" in
  700|500) ;;
  *) refuse "secrets directory mode is $dir_mode; want 700" ;;
esac
python3 - "$key" << 'PY' || refuse "settler key is not a 64-byte solana-keygen file"
import json, sys
from pathlib import Path
raw = Path(sys.argv[1]).read_text(encoding="utf-8").strip()
if raw.startswith("["):
    values = json.loads(raw)
    ok = isinstance(values, list) and len(values) == 64 and all(isinstance(n, int) and 0 <= n <= 255 for n in values)
else:
    alphabet = set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
    ok = 80 <= len(raw) <= 90 and set(raw) <= alphabet
sys.exit(0 if ok else 1)
PY
if [[ -e "$secrets_dir/authority_secret_key" ]]; then
  refuse "operator key file must not sit on this box"
fi

if [[ -n "${AOF_SKR_CRAFT:-}" || -n "${AOF_RANDOMNESS:-}" || -n "${AUTHORITY_SECRET_KEY:-}" ]]; then
  refuse "shell environment sets a closed flag or the operator key"
fi

unset COMPOSE_FILE COMPOSE_PROFILES
compose=(docker compose -f "$root/docker-compose.prod.yml" -f "$root/docker-compose.vps.yml")
if printf '%s\n' "${compose[@]}" | grep -q 'docker-compose.secrets.yml'; then
  refuse "refusing to combine the operator-key overlay"
fi

if [[ "$apply" -eq 0 ]]; then
  echo "ops/up: check passed for $cluster; not starting containers"
  echo "ops/up: ${compose[*]} up -d --build backend vrf-settler"
  exit 0
fi

release="$root/ops/deploy/release.sha"
[[ -f "$release" ]] || refuse "ops/deploy/release.sha missing; pin the reviewed commit before --apply"
want="$(tr -d '[:space:]' < "$release")"
have="$(git rev-parse HEAD)"
[[ "$want" == "$have" ]] || refuse "HEAD $have is not the pinned release"
dirty="$(git status --porcelain -- \
  aof_backend/src aof_backend/services aof_backend/scripts aof_backend/prisma \
  aof_backend/package.json aof_backend/package-lock.json \
  aof_backend/tsconfig.json aof_backend/tsconfig.workers.json aof_backend/Dockerfile \
  docker-compose.prod.yml docker-compose.vps.yml)"
[[ -z "$dirty" ]] || refuse "image inputs are dirty; commit them or stash before --apply"
[[ -f "$root/frontend/dist/index.html" ]] || refuse "frontend/dist is missing; run ops/build-static.sh first"
command -v docker >/dev/null 2>&1 || refuse "docker is not installed"
"${compose[@]}" up -d --build backend vrf-settler
