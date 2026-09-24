#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Rust unit tests (aof-core + programs) ==="
echo "cargo test --workspace --lib"
echo "Покрывает: economics, randomness, lottery math, marketplace, state, etc."
echo "Ожидается ~50+ тестов, без валидатора, быстро"
echo ""
if command -v cargo >/dev/null 2>&1; then
  cargo test --workspace --lib
else
  echo "cargo не найден — пропускаю (нужен rust 1.89.0)"
fi

echo ""
echo "=== 2. Anchor integration tests (aof_core.ts) — 26 тестов ==="
echo "Тяжёлые, требуют solana-test-validator, 2 минуты"
echo "Покрывают критичные инварианты безопасности из аудита"
node scripts/ensure-env.mjs 2>/dev/null || node scripts/ensure-env.js 2>/dev/null || true
anchor test --skip-build || echo "anchor test failed, попробуй anchor test --skip-build вручную"

echo ""
echo "=== 3. Backend self-tests (aof_backend) ==="
cd aof_backend
for t in test:wallet-proof test:authority-gate test:resource-registry test:security-invariants test:audit-security test:admin-auth test:fraud-signals test:reward-receipts; do
  echo "--- $t ---"
  npm run $t 2>&1 | tail -n 20 || echo "failed: $t"
done
cd ..

echo ""
echo "=== 4. Readiness / OS / Frontend / Watchtower ==="
echo "--- readiness ---"
node --test tests/readiness/*.test.cjs 2>&1 | tail -n 20 || true
echo "--- os ---"
npm test --prefix src/os 2>&1 | tail -n 20 || true
echo "--- frontend security ---"
npm run test:security --prefix frontend 2>&1 | tail -n 20 || true
echo "--- watchtower ---"
npm test --prefix watchtower 2>&1 | tail -n 20 || true

echo ""
echo "=== Done ==="
echo "Итого: ~26 (anchor) + ~50 (rust) + ~15 (backend self) + ~10 (readiness/os/frontend/watchtower) = ~100 тестов"
