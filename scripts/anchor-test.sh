#!/usr/bin/env bash
# Local `anchor test --skip-build`.
#
# Randomness is the SlotHashes sysvar. The Switchboard test double and its
# genesis pin were removed; this wrapper must not put them back. Anchor.toml
# is not modified.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if grep -q 'SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv' Anchor.toml; then
  echo "[anchor-test] Anchor.toml must not pin a Switchboard genesis program" >&2
  exit 1
fi
if [ -d tests/mock-switchboard ]; then
  echo "[anchor-test] tests/mock-switchboard must stay deleted" >&2
  exit 1
fi

echo "[anchor-test] anchor test --skip-build"
exec anchor test --skip-build "$@"
