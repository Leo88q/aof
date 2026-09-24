# Local dev shortcuts that work around the upstream IDL build breakage
# See docs/BUILD_TROUBLESHOOTING.md

.PHONY: ensure-idl build no-idl test

ensure-idl:
	node scripts/ensure-idl.mjs

build: ensure-idl
	@echo "Building programs with --no-idl (required due to proc-macro2 1.0.94 vs Anchor 0.30.1)"
	anchor build --no-idl --skip-lint || anchor build --no-idl

no-idl: build

test: ensure-idl
	anchor test --skip-build

test-mocha: ensure-idl
	npx tsx node_modules/mocha/bin/mocha.js -t 1000000 tests/aof_core.ts
