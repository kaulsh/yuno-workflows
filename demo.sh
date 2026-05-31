#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Error: .env not found in the repository root." >&2
  echo >&2
  echo "Create one from the example and fill in the required keys:" >&2
  echo "  cp .env.example .env" >&2
  echo >&2
  echo "Required: DATABASE_URL, RABBITMQ_URL, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

compose_started=0
compose_down_ran=0

cleanup() {
  if [[ "$compose_down_ran" -eq 1 ]]; then
    return
  fi
  compose_down_ran=1
  if [[ "$compose_started" -eq 1 ]]; then
    echo
    echo "Stopping Docker services…"
    pnpm compose:down || true
  fi
}

trap cleanup EXIT INT TERM

echo "Installing dependencies…"
pnpm install

echo "Starting infrastructure (Docker)…"
pnpm compose:up -d
compose_started=1

wait_for_postgres() {
  local attempt=0
  local max_attempts=60

  echo "Waiting for PostgreSQL…"
  until docker compose exec -T yuno-postgres pg_isready -U root -d db >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if (( attempt >= max_attempts )); then
      echo "Error: PostgreSQL did not become ready within ${max_attempts}s." >&2
      exit 1
    fi
    sleep 1
  done
  echo "PostgreSQL is ready."
}

wait_for_postgres

echo "Applying database migrations…"
pnpm --filter @workspace/db-adapter run prisma:generate
pnpm --filter @workspace/db-adapter exec prisma migrate deploy

echo "Seeding database…"
pnpm seed

echo "Starting application (API, worker, web)…"
echo "Press Ctrl+C to stop."
pnpm start
