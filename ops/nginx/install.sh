#!/usr/bin/env bash
# Install the host nginx site. --check never writes to /etc.
# --apply requires a real server name and a freshly written Cloudflare range file.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
apply=0
case "${1:-}" in
  --check|"") apply=0 ;;
  --apply) apply=1 ;;
  *) echo "usage: ops/nginx/install.sh [--check|--apply]" >&2; exit 2 ;;
esac

example="$root/ops/nginx/aof.conf.example"
headers="$root/ops/nginx/security-headers.conf"
ranges="${AOF_CF_RANGES:-/etc/nginx/snippets/cloudflare-real-ip.conf}"
name="${AOF_SERVER_NAME:-}"

[[ -f "$example" && -f "$headers" ]] || { echo "ops/nginx: example files missing" >&2; exit 1; }
grep -q '127.0.0.1:8080' "$example" || { echo "ops/nginx: API upstream drifted" >&2; exit 1; }
if grep -Eq '^[[:space:]]*listen[[:space:]]+8080([^0-9]|$)' "$example"; then
  echo "ops/nginx: public listener must not take the API port" >&2
  exit 1
fi
grep -q 'aof-security-headers.conf' "$example" || { echo "ops/nginx: security headers not included" >&2; exit 1; }
grep -q "script-src 'self'" "$headers" || { echo "ops/nginx: CSP snippet drifted from frontend/public/_headers" >&2; exit 1; }

if [[ "$apply" -eq 0 ]]; then
  echo "ops/nginx: check passed; not writing /etc (pass --apply on the VPS)"
  exit 0
fi

[[ -n "$name" && "$name" != "app.example.com" ]] || { echo "ops/nginx: set AOF_SERVER_NAME" >&2; exit 1; }
[[ "$name" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "ops/nginx: AOF_SERVER_NAME is not a hostname" >&2; exit 1; }
[[ -s "$ranges" ]] || { echo "ops/nginx: run refresh-cloudflare-ips.sh before --apply" >&2; exit 1; }
[[ "$ranges" == /etc/nginx/snippets/cloudflare-real-ip.conf ]] || { echo "ops/nginx: the site includes /etc/nginx/snippets/cloudflare-real-ip.conf; refresh must write that path" >&2; exit 1; }
if [[ "${AOF_ORIGIN_FIREWALL:-}" != "external" ]]; then
  stamp="/var/lib/aof/origin-locked"
  [[ -f "$stamp" ]] || { echo "ops/nginx: run lock-origin.sh --apply, or set AOF_ORIGIN_FIREWALL=external if the provider firewall already limits port 80" >&2; exit 1; }
  current="$(sha256sum "$ranges" | awk '{print $1}')"
  stamped="$(awk '{print $1}' "$stamp")"
  [[ "$current" == "$stamped" ]] || { echo "ops/nginx: Cloudflare ranges changed; run lock-origin.sh --apply again" >&2; exit 1; }
fi
command -v nginx >/dev/null 2>&1 || { echo "ops/nginx: nginx is not installed" >&2; exit 1; }
[[ ! -e /etc/nginx/sites-enabled/default ]] || { echo "ops/nginx: disable sites-enabled/default before installing, or it can take port 80" >&2; exit 1; }

install -d -m 755 /etc/nginx/snippets /etc/nginx/sites-available /etc/nginx/sites-enabled
install -m 644 "$headers" /etc/nginx/snippets/aof-security-headers.conf
tmp="$(mktemp)"
sed "s/app\\.example\\.com/${name//\//\\/}/" "$example" > "$tmp"
install -m 644 "$tmp" /etc/nginx/sites-available/aof.conf.new
rm -f "$tmp"
previous=""
if [[ -L /etc/nginx/sites-enabled/aof.conf ]]; then
  previous="$(readlink -f /etc/nginx/sites-enabled/aof.conf || true)"
fi
ln -sfn /etc/nginx/sites-available/aof.conf.new /etc/nginx/sites-enabled/aof.conf
if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/aof.conf /etc/nginx/sites-available/aof.conf.new
  if [[ -n "$previous" && -f "$previous" ]]; then
    ln -sfn "$previous" /etc/nginx/sites-enabled/aof.conf
  fi
  echo "ops/nginx: nginx -t failed; previous site restored" >&2
  exit 1
fi
mv /etc/nginx/sites-available/aof.conf.new /etc/nginx/sites-available/aof.conf
ln -sfn /etc/nginx/sites-available/aof.conf /etc/nginx/sites-enabled/aof.conf
echo "ops/nginx: site installed for $name; reload nginx yourself after reviewing nginx -t"
