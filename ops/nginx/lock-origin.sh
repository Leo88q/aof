#!/usr/bin/env bash
# Limit host port 80 to the Cloudflare ranges nginx already trusts.
# Does not reset the firewall and allows SSH before any deny rule.
set -euo pipefail

apply=0
case "${1:-}" in
  --check|"") apply=0 ;;
  --apply) apply=1 ;;
  *) echo "usage: ops/nginx/lock-origin.sh [--check|--apply]" >&2; exit 2 ;;
esac

ranges="${AOF_CF_RANGES:-/etc/nginx/snippets/cloudflare-real-ip.conf}"
[[ -s "$ranges" ]] || { echo "ops/nginx: missing Cloudflare ranges; run refresh-cloudflare-ips.sh" >&2; exit 1; }
python3 - "$ranges" << 'PY'
import ipaddress, sys
from pathlib import Path
rows = [line.strip() for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")]
if len(rows) < 10:
    raise SystemExit("ops/nginx: range list is too short")
for row in rows:
    if not row.startswith("set_real_ip_from ") or not row.endswith(";"):
        raise SystemExit(f"ops/nginx: unexpected range line {row!r}")
    ipaddress.ip_network(row[len("set_real_ip_from "):-1].strip())
PY

if [[ "$apply" -eq 0 ]]; then
  echo "ops/nginx: origin ranges look usable; not changing the firewall"
  exit 0
fi
[[ "${AOF_LOCK_ORIGIN:-}" == "yes" ]] || { echo "ops/nginx: set AOF_LOCK_ORIGIN=yes to apply" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || { echo "ops/nginx: lock-origin --apply must run as root" >&2; exit 1; }
command -v ufw >/dev/null 2>&1 || { echo "ops/nginx: ufw is not installed" >&2; exit 1; }

# Allow SSH before enabling the firewall. Do not reset existing rules.
ssh_port="${AOF_SSH_PORT:-22}"
[[ "$ssh_port" =~ ^[0-9]+$ ]] || { echo "ops/nginx: AOF_SSH_PORT must be numeric" >&2; exit 1; }
ufw allow "${ssh_port}/tcp"
python3 - "$ranges" << 'PY' | while read -r cidr; do
import ipaddress, sys
from pathlib import Path
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line.startswith("set_real_ip_from "):
        continue
    print(line[len("set_real_ip_from "):-1].strip())
PY
  ufw allow from "$cidr" to any port 80 proto tcp
done
ufw deny 80/tcp
ufw deny 8080/tcp
ufw deny 8081/tcp
ufw deny 8790/tcp
ufw --force enable
install -d -m 755 /var/lib/aof
sha256sum "$ranges" > /var/lib/aof/origin-locked
echo "ops/nginx: port 80 is limited to the current Cloudflare ranges; SSH stays allowed"
