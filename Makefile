# GradApply — common tasks (requires GNU Make; uses pnpm).
PNPM ?= pnpm

.PHONY: help install dev build lint predeploy start clean env db-push db-seed db-studio migrate ops-check

help: ## Show available targets
	@echo "GradApply — try: make install && make env && make db-push && make db-seed && make dev"
	@echo ""
	@grep -hE '^[a-zA-Z0-9_-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

install: ## Install dependencies (pnpm)
	$(PNPM) install

env: ## Create .env from .env.example if missing
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example — edit DATABASE_URL and AUTH_SECRET next."; else echo ".env already exists (skipped copy)."; fi

dev: ## Run Next.js dev server (http://localhost:3000)
	$(PNPM) dev

build: ## Production build (Prisma generate + next build)
	$(PNPM) build

lint: ## Run ESLint
	$(PNPM) lint

predeploy: ## Same checks as CI + production build (before ship)
	$(PNPM) run predeploy

ops-check: ## Fast gate: prisma generate + lint + typecheck (no full build)
	$(PNPM) run ops:release-check

start: ## Start production server (run make build first)
	$(PNPM) start

clean: ## Remove Next.js build output (.next)
	rm -rf .next

db-push: ## Sync database schema (Prisma db push — handy for local dev)
	$(PNPM) db:push

db-seed: ## Create/update seed user (prints test login — see README)
	$(PNPM) db:seed

db-studio: ## Open Prisma Studio (browse DB in browser)
	$(PNPM) db:studio

migrate: ## Apply SQL migrations (production / staging DATABASE_URL)
	$(PNPM) exec prisma migrate deploy

setup: ## Install deps + copy .env if missing (then edit .env; db-push + db-seed + dev)
	@$(MAKE) env
	@$(MAKE) install
	@echo ""
	@echo "Next: edit .env (DATABASE_URL, AUTH_SECRET), then: make db-push && make db-seed && make dev"
