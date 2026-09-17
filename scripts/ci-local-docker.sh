#!/usr/bin/env bash
# Local "clean runner": replays .github/workflows/ci.yml inside a fresh Ubuntu
# container so the result does not depend on the developer machine (Node
# version, stray @types/*, cached target/, existing program keypairs...).
#
# Use when GitHub Actions is unavailable (e.g. billing block). It is the same
# sequence and the same pinned versions as CI:
#   Rust 1.89.0 / Agave 4.2.1 / Anchor CLI 0.30.1 / Node 20
# and the same CI-only mechanics: throwaway provider wallet, throwaway program
# keypairs + `anchor keys sync`, target/idl seeded from the committed backend
# IDLs (the Anchor IDL builder is upstream-blocked on 0.30.1), every gate
# blocking with its real exit code.
#
# Usage (from the repository root, Docker Desktop running, >= 8 GB RAM for Docker):
#   scripts/ci-local-docker.sh            # full run, ~30-60 min the first time
#   scripts/ci-local-docker.sh --shell    # drop into the container instead
#
# The repository is `git clone`d INSIDE the container from the host checkout
# (read-only mount), so nothing on the host is modified. Toolchains and cargo
# caches live in named Docker volumes and are reused by later runs.
# Logs: ./ci-local-logs/<timestamp>/ (gitignored).
#
# seccomp=unconfined: Agave 4.x's accounts-db asserts io_uring support at
# startup (solana_accounts_db::utils::create_accounts_run_and_snapshot_dirs),
# and Docker's default seccomp profile blocks the io_uring_* syscalls. GitHub
# runners are plain VMs, so CI is unaffected. The container is throwaway and
# mounts the checkout read-only.
#
# Apple Silicon: io_uring must also exist in the Linux VM kernel. Docker
# Desktop >= 4.25 (linuxkit 6.x) has it; "Use Rosetta" must be enabled.
# If the smoke test still panics on io_uring, install `colima` and run
#   colima start --arch x86_64 --vm-type vz --cpu 6 --memory 10
# then rerun this script (the docker CLI will target colima).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-run}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOGDIR="$ROOT/ci-local-logs/$STAMP"
mkdir -p "$LOGDIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found - install Docker Desktop first" >&2; exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running - start Docker Desktop" >&2; exit 2
fi

# ubuntu-latest on GitHub = 24.04 (glibc 2.39); the prebuilt Anchor 0.30.2
# binary needs GLIBC_2.38, so 22.04 cannot run it.
IMAGE="ubuntu:24.04"

# Everything below the marker is executed inside the container.
# linux/amd64 on purpose: Anza publishes prebuilt Agave binaries only for
# x86_64 Linux. On Apple Silicon enable "Use Rosetta for x86_64/amd64 emulation"
# in Docker Desktop > Settings > General (much faster than QEMU).
TTY_FLAGS="-t"; [ "$MODE" = "--shell" ] && TTY_FLAGS="-it"
docker run --rm $TTY_FLAGS \
  --platform linux/amd64 \
  --ulimit nofile=1000000:1000000 \
  --shm-size 2g \
  --security-opt seccomp=unconfined \
  -v "$ROOT:/src:ro" \
  -v "$LOGDIR:/logs" \
  -v aof-ci-cargo:/root/.cargo \
  -v aof-ci-rustup:/root/.rustup \
  -v aof-ci-solana:/root/.local/share/solana \
  -v aof-ci-target:/work-target \
  -v aof-ci-npm:/root/.npm \
  -e HOST_COMMIT="$(git -C "$ROOT" rev-parse HEAD)" \
  -e MODE="$MODE" \
  "$IMAGE" bash -c "$(sed -n '/^#=== CONTAINER ===$/,$p' "$0")"
rc=$?
echo
echo "logs: $LOGDIR"
echo "docker runner exit: $rc"
exit $rc

#=== CONTAINER ===
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
RUST_VERSION=1.89.0
AGAVE_VERSION=4.2.1
ANCHOR_VERSION=0.30.1
NODE_MAJOR=20
CI_WALLET_PATH=solana/keys/aof-authority-devnet.json

SUMMARY=/logs/summary.txt
: > "$SUMMARY"
overall=0
step() { # step "<name>" cmd...
  local name="$1"; shift
  local log="/logs/$(echo "$name" | tr ' /:()' '_____' | tr -cd '[:alnum:]_.-').log"
  echo; echo "=================================================================="
  echo ">>> $name"; echo "=================================================================="
  ( "$@" ) 2>&1 | tee "$log"
  local rc=${PIPESTATUS[0]}
  printf '%-58s exit=%s\n' "$name" "$rc" | tee -a "$SUMMARY"
  if [ "$rc" -ne 0 ]; then overall=1; fi
  return $rc
}
gate() { step "$@" || { echo "::error::blocking step failed: $1"; }; }

# ---------- system deps ----------
step "apt: build deps" bash -c '
  apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    ca-certificates curl git bzip2 xz-utils build-essential pkg-config \
    libssl-dev libudev-dev clang cmake protobuf-compiler python3 \
    libsqlite3-dev >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_'"$NODE_MAJOR"'.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
  node --version && npm --version' || exit 1

# ---------- Rust ----------
export PATH="$HOME/.cargo/bin:$PATH"
step "Install Rust $RUST_VERSION" bash -c '
  if ! command -v rustup >/dev/null; then
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none >/dev/null
  fi
  export PATH="$HOME/.cargo/bin:$PATH"
  rustup toolchain install '"$RUST_VERSION"' --profile minimal --component rustfmt >/dev/null
  rustup default '"$RUST_VERSION"' && rustc --version' || exit 1

# ---------- Agave ----------
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
step "Install Agave (Solana CLI) $AGAVE_VERSION" bash -c '
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  if solana --version 2>/dev/null | grep -q "'"$AGAVE_VERSION"'"; then echo "cached: $(solana --version)"; exit 0; fi
  sh -c "$(curl -sSfL https://release.anza.xyz/v'"$AGAVE_VERSION"'/install)" >/dev/null
  solana --version' || exit 1

# ---------- Anchor CLI ----------
# Same policy as CI: try to build 0.30.1 from source; if that fails, use the
# prebuilt 0.30.2 x86_64 binary plus an `avm` stub (Anchor shells out to
# `avm install 0.30.1` when Anchor.toml's anchor_version differs and aborts
# with a raw io error if avm is missing).
ANCHOR_FALLBACK_VERSION=0.30.2
step "Install Anchor CLI $ANCHOR_VERSION (fallback $ANCHOR_FALLBACK_VERSION)" bash -c '
  export PATH="$HOME/.cargo/bin:$PATH"
  if anchor --version 2>/dev/null | grep -qE "'"$ANCHOR_VERSION"'|'"$ANCHOR_FALLBACK_VERSION"'"; then echo "cached: $(anchor --version)"; exit 0; fi
  rm -f "$HOME/.cargo/bin/anchor"   # a stale binary that cannot run (glibc) must not count as cached
  echo "building anchor-cli v'"$ANCHOR_VERSION"' from source..."
  # anchor v0.30.1 locks time 0.3.29, which does not compile on rustc >= 1.80
  # (E0282 in format_description/parse). Bump only `time` inside a local clone,
  # then install from the clone; everything else stays as locked upstream.
  rm -rf /tmp/anchor-src && git clone -q --depth 1 --branch v'"$ANCHOR_VERSION"' https://github.com/coral-xyz/anchor /tmp/anchor-src
  ( cd /tmp/anchor-src && cargo update -p time --precise 0.3.36 >/dev/null 2>&1 || cargo update -p time >/dev/null 2>&1 )
  if cargo install --path /tmp/anchor-src/cli --locked --force > /logs/anchor-cli-build.log 2>&1 \
     || cargo install --path /tmp/anchor-src/cli --force >> /logs/anchor-cli-build.log 2>&1; then
    echo "installed from source: $(anchor --version)"; exit 0
  fi
  echo "::warning::source build failed (see /logs/anchor-cli-build.log, first error below); using prebuilt '"$ANCHOR_FALLBACK_VERSION"'"
  grep -nE "^error(\[|:)" -A6 /logs/anchor-cli-build.log | head -30
  curl -sSfL --retry 3 -o /tmp/anchor "https://github.com/coral-xyz/anchor/releases/download/v'"$ANCHOR_FALLBACK_VERSION"'/anchor-'"$ANCHOR_FALLBACK_VERSION"'-x86_64-unknown-linux-gnu"
  chmod +x /tmp/anchor && mv /tmp/anchor "$HOME/.cargo/bin/anchor"
  # avm stub lives next to anchor in ~/.cargo/bin (a persistent volume), so it survives reruns
  printf "#!/bin/sh\necho \"avm stub: this runner does not switch Anchor CLI versions\" >&2\nexit 1\n" > "$HOME/.cargo/bin/avm"
  chmod +x "$HOME/.cargo/bin/avm"
  v=$(anchor --version 2>&1) || { echo "::error::anchor binary does not run: $v"; exit 1; }
  echo "installed fallback: $v"' || exit 1

step "Verify toolchain" bash -c 'set -e; rustc --version; cargo --version; solana --version; anchor --version; node --version; python3 --version' || exit 1

# ---------- clean checkout ----------
step "Clean checkout of $HOST_COMMIT" bash -c '
  rm -rf /work && git clone -q /src /work && cd /work && git checkout -q "$HOST_COMMIT" && git log --oneline -1
  # reuse the SBPF target dir across runs (like the CI cache)
  mkdir -p /work-target && ln -s /work-target /work/target
  mkdir -p /work/solana/keys' || exit 1
cd /work

if [ "$MODE" = "--shell" ]; then exec bash; fi

step "Create throwaway provider wallet" bash -c '
  solana-keygen new --no-bip39-passphrase --silent --force -o '"$CI_WALLET_PATH"' && solana-keygen pubkey '"$CI_WALLET_PATH"''

# ---------- static gates (run against the committed ids, before key sync) ----------
gate "Gate: mint-writable (mint_to/burn need mut Mint)" python3 scripts/check-mint-writable.py
gate "Gate: IDL drift (source vs committed IDL)" python3 scripts/check-idl-drift.py

# ---------- CI key sync: throwaway program ids ----------
step "Generate program keypairs + anchor keys sync" bash -c '
  mkdir -p target/deploy
  for name in aof_core aof_liquidity aof_market aof_quests aof_rebirth aof_session_keys; do
    kp="target/deploy/${name}-keypair.json"
    [ -f "$kp" ] || solana-keygen new --silent --no-bip39-passphrase --force -o "$kp" >/dev/null
    echo "$name -> $(solana-keygen pubkey "$kp")"
  done
  anchor keys sync
  git --no-pager diff --stat' || exit 1

# ---------- programs ----------
gate "Anchor build --no-idl (SBPF compile gate)" bash -c '
  RUSTUP_TOOLCHAIN='"$RUST_VERSION"' anchor build --no-idl 2>&1 | grep -vE "^warning: unexpected .cfg. condition|^\s+(\||=|-->)|^$" | tail -40
  rc=${PIPESTATUS[0]}
  echo "anchor build exit code: $rc"
  ls -la target/deploy/*.so
  [ "$(ls target/deploy/*.so | wc -l)" -eq 6 ] || { echo "::error::expected 6 .so files"; exit 1; }
  exit $rc'

gate "Gate: IDL drift after key sync (ids from git)" python3 scripts/check-idl-drift.py --ids-from-git "$HOST_COMMIT"

step "Seed target/idl from committed backend IDLs (CI mechanism)" python3 - <<'PY'
import json, pathlib, sys
ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
def b58(raw):
    n = int.from_bytes(raw, "big"); out = ""
    while n: n, r = divmod(n, 58); out = ALPHABET[r] + out
    return "1" * (len(raw) - len(raw.lstrip(b"\x00"))) + (out or "1")
ids = {kp.name[:-len("-keypair.json")]: b58(bytes(json.loads(kp.read_text())[32:]))
       for kp in pathlib.Path("target/deploy").glob("*-keypair.json")}
pathlib.Path("target/idl").mkdir(parents=True, exist_ok=True)
n = 0
for src in sorted(pathlib.Path("aof_backend/src/idl").glob("*.json")):
    name = src.stem
    if name not in ids: print("skip", name); continue
    idl = json.loads(src.read_text()); idl["address"] = ids[name]
    (pathlib.Path("target/idl") / src.name).write_text(json.dumps(idl, indent=2))
    print(f"seeded target/idl/{src.name} address={ids[name]}"); n += 1
sys.exit(0 if n == 6 else 1)
PY

# solana-test-validator inside a container: it needs a writable ledger dir, a
# large open-files limit, and on Rosetta/QEMU it starts slowly. Smoke-test it
# first so a validator problem is reported as such (with its own log), and
# give anchor a longer startup_wait than the default 5000 ms.
step "Validator smoke test (solana-test-validator starts and answers RPC)" bash -c '
  # Mirrors the command that was verified to initialise under Docker Desktop /
  # Rosetta: plain flags, ledger on the container filesystem (not a volume).
  rm -rf /tmp/smoke-ledger
  RUST_LOG=info solana-test-validator --ledger /tmp/smoke-ledger --reset > /logs/validator-smoke.log 2>&1 &
  pid=$!
  ok=0; waited=0
  while [ $waited -lt 300 ]; do
    if solana cluster-version --url http://127.0.0.1:8899 >/dev/null 2>&1; then ok=1; break; fi
    if ! kill -0 $pid 2>/dev/null; then break; fi
    sleep 5; waited=$((waited+5))
  done
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  cp -f /tmp/smoke-ledger/validator.log /logs/validator-smoke-ledger.log 2>/dev/null || true
  if [ $ok -eq 1 ]; then echo "validator answered RPC after ~${waited}s"; exit 0; fi
  echo "::error::solana-test-validator did not become ready within 300s; stdout/stderr tail:"
  tail -30 /logs/validator-smoke.log
  echo "--- validator.log tail:"; tail -40 /logs/validator-smoke-ledger.log 2>/dev/null
  exit 1' || exit 1

gate "Anchor test (local validator)" bash -c '
  ulimit -n 1000000 2>/dev/null || ulimit -n 65536 || true
  # 300 s instead of the 5 s default: the validator is slow under emulation.
  grep -q "startup_wait" Anchor.toml || sed -i "s/^upgradeable = true/upgradeable = true\nstartup_wait = 300000/" Anchor.toml
  grep -n "startup_wait" Anchor.toml
  npm ci --no-audit --no-fund 2>&1 | tail -2
  : > /logs/anchor-test-full.log
  rc=0
  RUSTUP_TOOLCHAIN='"$RUST_VERSION"' anchor test --skip-build 2>&1 | tee -a /logs/anchor-test-full.log | grep -vE "^warning: unexpected .cfg. condition|^\s+(\||=|-->)" | tail -60 || rc=$?
  rc=${PIPESTATUS[0]}
  echo "anchor test exit code: $rc"
  if grep -Eq "^[[:space:]]*[1-9][0-9]* failing" /logs/anchor-test-full.log; then echo "::error::mocha reported failing tests"; rc=1; fi
  if ! grep -Eq "^[[:space:]]*[1-9][0-9]* passing" /logs/anchor-test-full.log; then echo "::error::no passing tests reported - suite did not run"; rc=1; fi
  grep -E "passing|failing" /logs/anchor-test-full.log
  cp -f .anchor/test-ledger/test-ledger-log.txt /logs/test-ledger-log.txt 2>/dev/null || true
  cp -f .anchor/test-ledger/validator.log /logs/test-ledger-validator.log 2>/dev/null || true
  exit $rc'

# ---------- backend ----------
gate "Backend: npm ci + build" bash -c 'cd aof_backend && npm ci --no-audit --no-fund 2>&1 | tail -2 && npm run build 2>&1 | tail -5'
gate "Backend: test:wallet-proof"          bash -c 'cd aof_backend && npm run test:wallet-proof'
gate "Backend: test:resource-registry"     bash -c 'cd aof_backend && npm run test:resource-registry'
gate "Backend: test:security-invariants"   bash -c 'cd aof_backend && npm run test:security-invariants'
gate "Backend: test:idempotency-db (Prisma CAS)" bash -c 'cd aof_backend && npm run test:idempotency-db'
gate "Backend: migration gate"             bash -c 'cd aof_backend && npm run prisma:migrate:check; rc=$?; rm -f prisma/.migrate-shadow.db .migrate-shadow.db; exit $rc'
gate "Hygiene: no tracked db/secrets" bash -c '
  bad=$(git ls-files | grep -Ei "\.(db|sqlite|sqlite3|pem|p12|pfx)$|keypair\.json$|(^|/)\.env(\.|$)" | grep -v "\.env\.example$" || true)
  if [ -n "$bad" ]; then echo "$bad"; exit 1; fi; echo "clean"'

# ---------- frontend ----------
gate "Frontend: npm ci + build" bash -c 'cd frontend && npm ci --no-audit --no-fund 2>&1 | tail -2 && npm run build 2>&1 | tail -8'
gate "Frontend: stylelint self-test"  bash -c 'cd frontend && npm run test:aof-stylelint'
gate "Frontend: design token lint"    bash -c 'cd frontend && npm run lint:aof-colors'

echo; echo "=================== SUMMARY ($HOST_COMMIT) ==================="
cat "$SUMMARY"
echo "=============================================================="
if [ "$overall" -eq 0 ]; then echo "RESULT: ALL GREEN"; else echo "RESULT: FAILURES (see logs)"; fi
exit $overall
