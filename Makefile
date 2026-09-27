# Local dev shortcuts that work around the upstream IDL build breakage
# See docs/BUILD_TROUBLESHOOTING.md

.PHONY: ensure-idl ensure-env build no-idl test test-mocha web-check web-sync web-install web-test web-build web-up load-test load-test-farm mutate mutants security-static audit-bundle

ensure-idl:
	node scripts/ensure-idl.mjs 2>/dev/null || node scripts/ensure-idl.js

ensure-env:
	node scripts/ensure-env.mjs 2>/dev/null || node scripts/ensure-env.js

build: ensure-env
	@echo "Building programs with --no-idl (required due to proc-macro2 1.0.94 vs Anchor 0.30.1)"
	anchor build --no-idl --skip-lint || anchor build --no-idl

no-idl: build

test: ensure-env
	anchor test --skip-build

test-mocha: ensure-env
	npx tsx node_modules/mocha/bin/mocha.js -t 1000000 tests/aof_core.ts

# --- Web-стек: сайт (/site) + игра (/) на Vite :3000 и API aof_backend :8080 ---
# Подробности и переменные (SKIP_BACKEND, WITH_ANCHOR, порты, RPC_URL): scripts/dev-local.sh
# make web-check — одной командой: свежие файлы/фото с GitHub + npm ci + тесты + сборка
web-check:
	bash scripts/dev-local.sh check

web-sync:
	bash scripts/dev-local.sh sync

web-install:
	bash scripts/dev-local.sh install

web-test:
	bash scripts/dev-local.sh test

web-build:
	bash scripts/dev-local.sh build

web-up:
	bash scripts/dev-local.sh up

# --- Нагрузка, мутационные тесты, статическая безопасность -------------------
# Подробности: docs/LOAD_TESTING.md, docs/REVIEW_DB_TESTS_LOAD_AI_2026-09-28.md
# Бэкенд для нагрузки поднимать с TRUST_PROXY_HOPS=1, иначе все VU — один IP.
LOAD_URL ?= http://localhost:8080
VUS ?= 50
DURATION ?= 30

load-test:
	node scripts/loadtest/nf-load.mjs --url $(LOAD_URL) --scenario mixed --vus $(VUS) --duration $(DURATION) --md reports/loadtest.md

load-test-farm:
	node scripts/loadtest/nf-load.mjs --url $(LOAD_URL) --scenario farm --mode players --vus $(VUS) --duration $(DURATION) --md reports/loadtest.md

# Мутационные тесты TS-модулей безопасности (без зависимостей; ~5 мин)
mutate:
	node scripts/mutation/nf-mutate.mjs --max 60 --md reports/mutation.md

# Мутационные тесты Rust-программ через cargo-mutants (cargo install cargo-mutants)
mutants:
	cargo mutants --workspace --no-shuffle -j 2 -- --lib

security-static:
	node scripts/security/check-hidden-unicode.mjs
	node scripts/security/agent-config-lock.mjs --check
	node --test tests/readiness/ai-agent-surface.test.cjs

audit-bundle:
	node scripts/security/ai-audit-bundle.mjs --out /tmp/aof-audit
	node scripts/security/ai-audit-bundle.mjs --out /tmp/aof-audit-nocomments --strip-comments
