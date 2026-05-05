# Makefile - Zappro Monorepo Control (MVM 05/2026)
# Canon: AGENTS.md | Engine: pnpm + turbo + biome

.PHONY: help install dev build test lint format typecheck clean smoke

help:
	@echo "🦍 Zappro Monorepo Command Center (MVM 05/2026)"
	@echo "------------------------------------------------"
	@echo "  make install      - Instala dependências (pnpm install)"
	@echo "  make dev          - Sobe o ambiente de dev (turbo run dev)"
	@echo "  make build        - Compila pacotes (turbo run build)"
	@echo "  make test         - Roda todos os testes unitários (turbo)"
	@echo "  make lint         - Verifica código (Biome via turbo)"
	@echo "  make format       - Formata código (Biome)"
	@echo "  make typecheck    - Roda verificação de tipos (tsc)"
	@echo "  make smoke        - Validação E2E/Smoke Tests (Playwright)"
	@echo "  make clean        - Limpa artefatos, módulos e cache"

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

typecheck:
	pnpm typecheck

smoke:
	@echo "=== 🦍 Executando Health Check & Smoke Tests ==="
	@bash scripts/health-check.sh || echo "⚠️ Aviso: Health-check falhou ou script não encontrado."
	@if [ -f "smoke-tests/smoke-chat-zappro-site.sh" ]; then \
		bash smoke-tests/smoke-chat-zappro-site.sh; \
	fi
	@if [ -f "smoke-tests/playwright-chat-e2e.mjs" ]; then \
		node smoke-tests/playwright-chat-e2e.mjs chat.zappro.site; \
	fi

clean:
	pnpm clean
