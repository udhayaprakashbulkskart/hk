#!/usr/bin/env bash
# Runs the integration suite against an isolated database and a dedicated server.
#   TEST_DATABASE_URL=postgresql://... npm run test:integration
# The test DB is migrated and re-seeded on every run — never point it at real data.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a disposable Postgres database}"
PORT="${TEST_PORT:-3100}"
export DATABASE_URL="$TEST_DATABASE_URL"
export RAZORPAY_KEY_ID=rzp_test_key RAZORPAY_KEY_SECRET=rzp_test_secret_for_tests RAZORPAY_WEBHOOK_SECRET=whsec_for_tests
export RAZORPAY_API_BASE=http://localhost:4010 RATE_LIMIT_DISABLED=true CRON_SECRET=test-cron-secret STORAGE_DRIVER=local
export TEST_BASE_URL="http://localhost:$PORT"

npx prisma migrate deploy >/dev/null
npx tsx prisma/seed.ts >/dev/null

npx next dev -p "$PORT" >/tmp/pubgstore-test-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "$TEST_BASE_URL/api/auth/me" >/dev/null && break; sleep 1; done

npx vitest run tests/integration
