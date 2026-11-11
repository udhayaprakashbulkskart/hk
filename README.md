# HK FinHub

A global fintech platform with a Hong Kong-inspired premium interface: a responsive web app, iOS and Android apps, an internal admin panel, and one shared backend.

**Status:** Phase 1 complete (architecture and monorepo skeleton). No product code yet.

## Read first

- [`docs/architecture.md`](docs/architecture.md): system design, technology choices, ledger model, provider model, security controls and open decisions.
- [`docs/roadmap.md`](docs/roadmap.md): 12-phase plan, exit criteria, provider approvals and credentials still needed.

## Important

- HK FinHub does not hold itself out as a licensed bank. All payment, FX, KYC, custody and trading services are provided by authorised partners.
- Real-money features are disabled until the partner approvals in the roadmap are confirmed. They are gated by feature flags and approval records.
- Balances are derived from an immutable double-entry ledger. A balance changes only after a verified provider confirmation.

## Repository layout

```
apps/           web (Next.js), mobile (Expo), admin (Next.js), api (NestJS)
packages/       ui, types, config, shared
services/       domain modules: authentication, accounts, ledger, wallet, payments,
                transfers, fx, investment, kyc, compliance, notifications
integrations/   provider adapters: razorpay, razorpayx, stripe, adyen, zerodha, drivewealth
database/       Prisma schema and migrations (Phase 4+)
infrastructure/ Docker, Terraform, Kubernetes
tests/          contract, integration, E2E and security tests
docs/           architecture, roadmap, API docs
```

## Local setup (Phase 1 only)

Requirements: Node.js 22, pnpm 9, Docker.

```bash
cp .env.example .env            # fill in POSTGRES_PASSWORD and REDIS_PASSWORD, plus the CHANGE_ME values
docker compose -f infrastructure/docker/docker-compose.dev.yml --env-file .env up -d
```

Application install and run commands arrive with Phase 2 (web) and Phase 4 (API).

## Secrets

Never commit `.env` or any credential. `.env.example` contains placeholders only. Customer documents must never enter the repository (see `.gitignore`).
