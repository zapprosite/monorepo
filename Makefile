# Makefile for monorepo testing
# Run with: make test-all, make lint, make smoke, etc.

.PHONY: help test test-all smoke smoke-py smoke-ts lint format typecheck clean

help:
	@echo "Available targets:"
	@echo "  test-all       - Run all tests (Vitest + Pytest + Playwright)"
	@echo "  smoke          - Run Python smoke tests (pytest)"
	@echo "  smoke-py       - Run Python smoke tests only"
	@echo "  smoke-ts       - Run TypeScript Vitest tests only"
	@echo "  lint           - Run all linters (ESLint + Biome)"
	@echo "  lint-fix       - Auto-fix lint issues"
	@echo "  format         - Auto-format code"
	@echo "  typecheck      - Run TypeScript type checking"
	@echo "  e2e            - Run Playwright E2E tests"
	@echo "  env-validate   - Run environment variable validation"
	@echo "  clean          - Clean test artifacts"

test-all: typecheck lint smoke-ts smoke-py

smoke: smoke-py smoke-ts

smoke-py:
	@echo "=== Running Python smoke tests ==="
	cd /srv/monorepo/smoke-tests && \
		python3 -m pytest -v --tb=short -m "$(if $(CI),ci,not ci)" 2>&1 | tail -50

smoke-ts:
	@echo "=== Running TypeScript Vitest tests ==="
	cd /srv/monorepo && pnpm --filter hermes-agency test 2>&1 | tail -30
	cd /srv/monorepo && pnpm --filter api test 2>&1 | tail -30

lint:
	@echo "=== Running ESLint ==="
	cd /srv/monorepo && pnpm lint 2>&1 | tail -20
	@echo "=== Running Biome check ==="
	cd /srv/monorepo && npx biome check --write=false apps/hermes-agency/src apps/api/src 2>&1 | tail -30

lint-fix:
	cd /srv/monorepo && pnpm lint --fix 2>&1 | tail -20
	npx biome check --write=true apps/hermes-agency/src apps/api/src 2>&1 | tail -20

format:
	cd /srv/monorepo && pnpm format 2>&1 | tail -10

typecheck:
	@echo "=== Running TypeScript type checking ==="
	cd /srv/monorepo && pnpm typecheck 2>&1 | tail -30

e2e:
	@echo "=== Running Playwright E2E tests ==="
	cd /srv/monorepo && npx playwright test --reporter=list 2>&1 | tail -40

env-validate:
	@echo "=== Validating environment configuration ==="
	bash /srv/monorepo/smoke-tests/smoke_env_vars.sh 2>&1
	bash /srv/monorepo/smoke-tests/smoke_lint.sh --check 2>&1 | tail -30

clean:
	@echo "Cleaning test artifacts..."
	find /srv/monorepo -name "*.log" -path "*/logs/*" -delete 2>/dev/null || true
	find /srv/monorepo -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
	find /srv/monorepo -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
	find /srv/monorepo -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
	cd /srv/monorepo/smoke-tests && rm -rf __pycache__ .pytest_cache *.pyc 2>/dev/null || true
	@echo "Clean complete"
