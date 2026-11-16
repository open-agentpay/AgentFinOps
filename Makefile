.PHONY: test gateway-build gateway-test gateway-clean console-dev console-build console-test marketplace-dev marketplace-build marketplace-lint docker-build docker-push compose-up compose-down check clean demo demo-live

# Run all test suites across the project
test: gateway-test console-test

# Go Gateway targets
gateway-build:
	$(MAKE) -C services/gateway build

gateway-test:
	$(MAKE) -C services/gateway test

gateway-clean:
	$(MAKE) -C services/gateway clean

# Console targets (Vue 3 + Element Plus)
console-dev:
	pnpm --prefix apps/console run dev

console-build:
	pnpm --prefix apps/console run build

console-test:
	pnpm --prefix apps/console run test

# Marketplace targets (Next.js 15)
marketplace-dev:
	pnpm --prefix apps/marketplace-web run dev

marketplace-build:
	@echo "Building and bundling docs into apps/marketplace-web/public/docs..."
	node scripts/sync-specs.mjs && DOCS_BASE=/docs/ npx vitepress build docs && rm -rf apps/marketplace-web/public/docs && cp -r docs/.vitepress/dist apps/marketplace-web/public/docs
	pnpm --prefix apps/marketplace-web run build

marketplace-lint:
	pnpm --prefix apps/marketplace-web run lint

# Docker build & Compose targets
docker-build:
	./scripts/docker-build-push.sh

docker-push:
	./scripts/docker-build-push.sh --push

compose-up:
	docker compose up -d --build

compose-down:
	docker compose down

# Run complete verification: gateway tests, console tests, and marketplace lint
check: gateway-test console-test marketplace-lint

# Clean build artifacts and test caches
clean: gateway-clean
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Runaway agent circuit breaker demo (Local simulation)
demo:
	python3 examples/runaway-agent/demo.py

# Runaway agent circuit breaker demo (Live simulation)
demo-live:
	python3 examples/runaway-agent/demo.py --live
