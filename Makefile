# GradApply — convenience targets (wraps pnpm scripts).
# Usage: make help

.DEFAULT_GOAL := help
SHELL := /bin/bash

PNPM        ?= pnpm
DATABASE_URL_TEST ?= postgresql://postgres:pass@localhost:5433/gradapply_test

.PHONY: help install dev start build lint typecheck check ci \
	test test-coverage test-unit test-integration test-db test-db-up test-db-down test-db-local \
	test-e2e test-e2e-smoke test-e2e-staging test-seed-e2e \
	prisma-generate prisma-migrate prisma-studio prisma-seed \
	cf-build cf-deploy cf-tail cf-tail-app cf-tail-errors \
	mail-test version-sync version-verify

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_.-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# --- Dependencies & dev ---

install: ## Install dependencies (pnpm install)
	$(PNPM) install

dev: ## Start Next.js dev server
	$(PNPM) run dev

start: ## Start production server (run `make build` first)
	$(PNPM) run start

# --- Quality ---

lint: ## ESLint
	$(PNPM) run lint

typecheck: ## TypeScript (tsc --noEmit)
	$(PNPM) run typecheck

check: lint typecheck test ## Lint + typecheck + unit/integration tests

ci: check ## Same checks as PR CI (no E2E)

# --- Build ---

build: ## Production build (prisma generate + next build)
	$(PNPM) run build

# --- Tests (Vitest) ---

test: ## All Vitest tests (unit + integration, no *.db.test.ts)
	$(PNPM) run test

test-coverage: ## Vitest with P0 coverage thresholds (see tests/README.md)
	$(PNPM) run test:coverage

test-unit: ## Unit tests only
	$(PNPM) run test:unit

test-integration: ## Handler integration tests (mocked Prisma)
	$(PNPM) run test:integration

test-db-up: ## Start Docker Postgres for DB tests (port 5433)
	$(PNPM) run test:db:up

test-db-down: ## Stop Docker Postgres and remove volumes
	$(PNPM) run test:db:down

test-db: ## Postgres integration tests (*.db.test.ts); needs DATABASE_URL_TEST
	DATABASE_URL_TEST="$(DATABASE_URL_TEST)" $(PNPM) run test:integration:db

test-db-local: ## Docker up + DB integration tests (one command)
	$(PNPM) run test:integration:db:local

# --- E2E (Playwright) ---

test-e2e: ## Full Playwright suite
	$(PNPM) run test:e2e

test-e2e-smoke: build ## Playwright smoke (builds app first)
	$(PNPM) run test:e2e:smoke

test-e2e-staging: ## Playwright against STAGING_URL
	$(PNPM) run test:e2e:staging

test-seed-e2e: ## Seed E2E users (needs DATABASE_URL or DATABASE_URL_TEST)
	$(PNPM) run test:seed-e2e

# --- Prisma ---

prisma-generate: ## prisma generate
	$(PNPM) exec prisma generate

prisma-migrate: ## prisma migrate deploy (uses DATABASE_URL from .env)
	$(PNPM) exec prisma migrate deploy

prisma-studio: ## Open Prisma Studio
	$(PNPM) exec prisma studio

prisma-seed: ## Run seed script
	$(PNPM) exec prisma db seed

# --- Cloudflare ---

cf-build: ## Build for Cloudflare Workers
	$(PNPM) run cf:build

cf-deploy: ## Deploy to Cloudflare (needs DATABASE_URL in .env for Hyperdrive)
	$(PNPM) run cf:deploy

cf-tail: ## Tail Worker logs
	$(PNPM) run cf:tail

cf-tail-app: ## Tail Worker logs (gradapply filter)
	$(PNPM) run cf:tail:app

cf-tail-errors: ## Tail Worker logs (errors only)
	$(PNPM) run cf:tail:errors

# --- Misc ---

mail-test: ## Send a test email (usage: make mail-test EMAIL=you@example.com)
	@test -n "$(EMAIL)" || (echo "Set EMAIL=you@example.com" && exit 1)
	$(PNPM) run mail:test $(EMAIL)

version-sync: ## Sync version from build.json
	$(PNPM) run version:sync

version-verify: ## Verify build version
	$(PNPM) run version:verify
