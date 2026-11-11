# apps/api: customer API (NestJS)

HTTP and realtime surface for the customer apps. Business rules live in `services/*`, persistence in `database/`. This package wires them together.

**Status: Phase 4.** Authentication, sessions, 2FA, devices, notifications pipeline and realtime delivery are implemented and covered by integration tests against real Postgres and Redis.

## Run locally

```bash
# 1. Dependencies: Postgres 16 and Redis 7 (see infrastructure/docker/docker-compose.dev.yml)
# 2. Configuration: copy .env.example and set the variables below
export APP_ENV=local
export DATABASE_URL=postgresql://hkfinhub:...@localhost:5432/hkfinhub
export REDIS_URL=redis://:...@localhost:6379/0
export JWT_ACCESS_SECRET="$(openssl rand -base64 64)"
export DIGEST_KEY="$(openssl rand -base64 32)"
export FIELD_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export EMAIL_PROVIDER=capture SMS_PROVIDER=capture   # local only; refused in production
pnpm --filter @hkfinhub/database exec prisma migrate deploy
pnpm --filter @hkfinhub/api start          # API on :4000
pnpm --filter @hkfinhub/api worker         # relays the outbox and delivers notifications
```

`loadConfig` refuses to start with a short JWT secret, a key that is not 32 bytes, or capture providers in production.

## Test

```bash
TEST_DATABASE_URL=... TEST_REDIS_URL=redis://:...@localhost:6379/15 pnpm --filter @hkfinhub/api test
```

The suite truncates the `_test` database and flushes Redis db 15 before each test. It refuses to run against a database without `_test` in its name.

## Layout

- `src/main.ts`: process entry (HTTP, realtime). `src/worker.ts`: outbox relay and notification delivery.
- `src/app.ts`: builds the Nest application: helmet, CORS, request ids, JSON limit (16 KB), error shaping.
- `src/auth/`: controllers, bearer-token guard, zod request schemas.
- `src/realtime.ts`: Socket.IO gateway. Authenticates the handshake and fans out Redis pub/sub events per user.
- `src/openapi.ts`: OpenAPI document generated from the same zod schemas the server validates with.
- `src/container.ts`: wires stores, the Redis rate limiter, the BullMQ queue and the providers.

## Design notes

- Dependencies are injected with explicit `@Inject(...)` tokens, and request bodies are validated with zod pipes. The app does not rely on TypeScript decorator metadata, so `tsx`, `vitest` and `tsc` behave the same.
- Error responses are generic for anything not raised by our own domain code. Parser and routing messages never reach the client.
- Sentry starts only when `SENTRY_DSN` is set (decision D13).
