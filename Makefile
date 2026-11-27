# Єдина точка входу (SPEC §5, F0-AC1). Змінює лише власник F0.
.PHONY: setup data-mock data check check-py check-web dev

setup:
	cd pipeline && uv sync
	cd web && npm ci

data-mock:
	cd pipeline && uv run python -m sky.build --mock

data:
	cd pipeline && uv run python -m sky.build

check-py:
	cd pipeline && uv run ruff check . && uv run ruff format --check . && uv run pytest -q

check-web:
	cd web && npm run lint && npm run typecheck && npm run test && npm run schemas && npm run build

check: data-mock check-py check-web

dev: data-mock
	cd web && npm run dev
