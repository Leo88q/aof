# Local dev shortcuts that work around the upstream IDL build breakage
# See docs/BUILD_TROUBLESHOOTING.md

.PHONY: ensure-idl ensure-env build no-idl test test-mocha web-check web-sync web-install web-test web-build web-up

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
