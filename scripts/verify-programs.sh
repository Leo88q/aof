#!/usr/bin/env bash
# Verify that every AOF program ID declared in Anchor.toml
#   1. exists on the target cluster and is an executable upgradeable program,
#   2. has the expected upgrade authority (or is frozen),
#   3. (optional) has on-chain bytecode whose sha256 matches a locally built .so.
#
# Usage:
#   scripts/verify-programs.sh <cluster: devnet|mainnet-beta|localnet|URL> [expected_authority_pubkey] [target/deploy dir]
#
# Exit code is non-zero on any mismatch. Requires: solana CLI, python3,
# sha256sum (GNU) или shasum (есть на macOS).
#
# Why sha256 of a dump and not of the .so file directly: the on-chain
# ProgramData account is padded to its allocated size, so the dump is truncated
# to the length of the local artifact before hashing. A local artifact that is
# LONGER than the on-chain program can never match and is reported as such.

set -euo pipefail

CLUSTER="${1:?cluster required (devnet|mainnet-beta|localnet|<rpc url>)}"
EXPECTED_AUTHORITY="${2:-}"
DEPLOY_DIR="${3:-target/deploy}"

case "$CLUSTER" in
  devnet)       URL="https://api.devnet.solana.com" ;;
  mainnet-beta) URL="https://api.mainnet-beta.solana.com" ;;
  localnet)     URL="http://127.0.0.1:8899" ;;
  http*)        URL="$CLUSTER" ;;
  *) echo "unknown cluster: $CLUSTER" >&2; exit 2 ;;
esac

SECTION="programs.devnet"
[[ "$CLUSTER" == "localnet" ]] && SECTION="programs.localnet"
[[ "$CLUSTER" == "mainnet-beta" ]] && SECTION="programs.mainnet"

# Портативные хелперы (macOS: BSD stat + shasum вместо GNU stat/sha256sum;
# bash 3.2: нет mapfile).
file_size() {
  if stat -c %s "$1" >/dev/null 2>&1; then
    stat -c %s "$1"          # GNU
  else
    stat -f%z "$1"           # BSD / macOS
  fi
}
if command -v sha256sum >/dev/null 2>&1; then
  sha256_file() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  sha256_file() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  echo "need sha256sum or shasum" >&2; exit 2
fi

ENTRIES=()
while IFS= read -r entry; do
  ENTRIES+=("$entry")
done < <(python3 - "$SECTION" <<'PY'
import sys, re
section = sys.argv[1]
text = open("Anchor.toml").read()
m = re.search(r"^\[" + re.escape(section) + r"\]\n(.*?)(?=^\[|\Z)", text, re.S | re.M)
if not m:
    sys.exit(f"section [{section}] not found in Anchor.toml")
for line in m.group(1).splitlines():
    line = line.strip()
    if not line or line.startswith("#"): continue
    k, v = [x.strip() for x in line.split("=", 1)]
    print(k, v.strip('"'))
PY
)

if [ ${#ENTRIES[@]} -eq 0 ]; then echo "no programs in [$SECTION]" >&2; exit 2; fi

fail=0
tmp="$(mktemp -d "${TMPDIR:-/tmp}/aofverify.XXXXXX")"; trap 'rm -rf "$tmp"' EXIT

printf '%-18s %-46s %-10s %-46s %s\n' PROGRAM ID STATUS AUTHORITY BYTECODE
for entry in "${ENTRIES[@]}"; do
  name="${entry%% *}"; pid="${entry##* }"
  status="missing"; authority="-"; bytecode="-"

  if info="$(solana program show "$pid" --url "$URL" --output json 2>/dev/null)"; then
    status="ok"
    authority="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("authority") or "none")' <<<"$info")"
    if [[ -n "$EXPECTED_AUTHORITY" && "$authority" != "$EXPECTED_AUTHORITY" && "$authority" != "none" ]]; then
      status="BAD_AUTH"; fail=1
    fi
    # Declared id inside the source must match the deployed id.
    src=""
    case "$name" in
      aof_core) src="aof-core/src/lib.rs" ;;
      *) src="programs/${name//_/-}/src/lib.rs" ;;
    esac
    if [[ -f "$src" ]] && ! grep -q "declare_id!(\"$pid\")" "$src"; then
      status="ID_DRIFT"; fail=1
    fi
    # Bytecode comparison (optional).
    so="$DEPLOY_DIR/$name.so"
    if [[ -f "$so" ]]; then
      if solana program dump "$pid" "$tmp/$name.dump" --url "$URL" >/dev/null 2>&1; then
        local_len=$(file_size "$so"); chain_len=$(file_size "$tmp/$name.dump")
        if (( local_len > chain_len )); then
          bytecode="MISMATCH(local>chain)"; fail=1
        else
          head -c "$local_len" "$tmp/$name.dump" > "$tmp/$name.trunc"
          # Remaining on-chain bytes past the local length must be zero padding.
          if tail -c +"$((local_len+1))" "$tmp/$name.dump" | tr -d '\0' | head -c1 | grep -q .; then
            bytecode="MISMATCH(trailing)"; fail=1
          elif [[ "$(sha256_file "$so")" == "$(sha256_file "$tmp/$name.trunc")" ]]; then
            bytecode="match $(sha256_file "$so" | cut -c1-12)"
          else
            bytecode="MISMATCH(hash)"; fail=1
          fi
        fi
      else
        bytecode="dump_failed"; fail=1
      fi
    else
      bytecode="no_local_so"
    fi
  else
    fail=1
  fi
  printf '%-18s %-46s %-10s %-46s %s\n' "$name" "$pid" "$status" "$authority" "$bytecode"
done

if (( fail )); then
  echo
  echo "VERIFICATION FAILED: at least one program is missing, has an unexpected authority, drifted from declare_id!, or bytecode differs." >&2
  exit 1
fi
echo
echo "all programs verified on $CLUSTER"
