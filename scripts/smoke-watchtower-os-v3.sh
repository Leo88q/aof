#!/usr/bin/env bash
# Runtime smoke (devnet) for Watchtower OS v3 — wrapper around src/os/smoke-devnet.js.
# Usage: scripts/smoke-watchtower-os-v3.sh [--offline]
set -euo pipefail
cd "$(dirname "$0")/../src/os"
exec node smoke-devnet.js "$@"
