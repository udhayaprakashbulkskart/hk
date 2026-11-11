# HK FinHub: Technical Architecture

Status: Phase 1 baseline. This is a design document. It describes the target system and records decisions. Where a decision depends on a partner, licence or regulator, it is marked **OPEN** and listed in section 15.

HK FinHub is a global fintech platform with a Hong Kong-inspired premium interface. It has a responsive web app, iOS and Android apps, an internal admin panel, and one shared backend. All four clients use the same authentication, accounts, ledger, payment and investment services.

---

## 1. Principles

1. **Real money moves only through authorised partners.** The platform never holds customer funds in its own name unless a licensed entity does so under contract. Every payment, payout, FX quote and trade is executed by an approved provider. The platform records and reconciles those outcomes.
2. **The ledger is the source of truth for money.** Balances are derived from immutable ledger entries. No code path edits a balance directly.
3. **A provider confirmation is required before any balance changes.** The UI and the API may show "pending" states. They never show a completed transfer that the provider has not confirmed.
4. **Production features are off by default.** Each live capability is gated by a feature flag and by an approval record in the database. Both must be set. A flag alone is not enough.
5. **Integer money only.** Amounts are stored and computed as `BigInt` minor units (for example, paise, cents, fils). Floats are never used for money.
6. **Least privilege for people and services.** RBAC for staff, scoped tokens for services, and private storage for identity documents.
7. **No collection of banking secrets.** The platform never asks for or stores bank login passwords, UPI PINs, or card CVVs. Payment collection happens on provider-hosted or provider-SDK screens.
8. **Modular monolith first.** One deployable API split into strict domain modules. Each module has its own tables and a public interface. Split into services only when load or team boundaries require it.

---

## 2. Repository layout

The spec's folder list is flat in places. The decisions below resolve the ambiguity and are final unless changed in a later ADR.

```
hk/                          (repository name "hk"; product name HK FinHub)
├── apps/                    deployable applications
│   ├── web/                 Next.js customer web app
│   ├── mobile/              Expo (React Native) iOS and Android app
│   ├── admin/               Next.js admin panel (private network)
│   └── api/                 NestJS REST + WebSocket API (composition root)
├── packages/                shared libraries with no business logic
│   ├── ui/                  design tokens, Hong Kong theme, UI primitives
│   ├── types/               API DTOs and shared types (generated from OpenAPI where possible)
│   ├── config/              shared ESLint, TypeScript and env-schema presets
│   └── shared/              money/minor-unit helpers, currency metadata, validators
├── services/                framework-agnostic domain modules (business rules, no HTTP)
│   ├── authentication/  accounts/  ledger/  wallet/  payments/  transfers/
│   ├── fx/  investment/  kyc/  compliance/  notifications/
├── integrations/            provider adapters implementing ports defined in services/
│   ├── razorpay/  razorpayx/  stripe/  adyen/  zerodha/  drivewealth/
├── database/                Prisma schema, migrations, seeds
├── infrastructure/          docker, terraform, k8s, CI/CD definitions
├── tests/                   contract, integration, end-to-end and security tests
└── docs/                    this document, roadmap, API docs, runbooks
```

**Why `services/` is not microservices.** These directories are libraries inside one process. `apps/api` imports them and wires them to HTTP, WebSocket and queue workers. This keeps transactions simple (a ledger post and a transfer status change can share a database transaction) and keeps deployment simple. Each domain can be extracted into its own deployable later because its boundary is already a package with a port interface.

**Dependency rule (enforced by lint in Phase 4):**
- `apps/*` may import `services/*`, `integrations/*`, `packages/*`.
- `services/*` may import `packages/shared`, `packages/types` and other `services/*` only through their public `index.ts`. They never import `apps/*` or `integrations/*` directly. They depend on **ports** (interfaces), and the composition root injects the adapters.
- `integrations/*` may import `packages/*` and their own provider SDK. They never import other integrations.
- `packages/*` import nothing from `apps`, `services` or `integrations`.

---

## 3. System context

```
  Customer web (Next.js)   Customer mobile (Expo)   Admin panel (Next.js, private)
            │  HTTPS / REST + WSS       │                     │  HTTPS (VPN / IP allow-list)
            └───────────────┬───────────┴─────────────────────┘
                            ▼
                 ┌──────────────────────────┐
                 │  API gateway / WAF / LB  │  rate limit, TLS, bot filter
                 └────────────┬─────────────┘
                              ▼
                 ┌──────────────────────────┐        ┌──────────────────┐
                 │  apps/api (NestJS)       │◄──────►│ PostgreSQL 16    │  system of record
                 │  REST, WebSocket, jobs   │        │ (Prisma)         │
                 └──┬─────────┬─────────┬───┘        └──────────────────┘
                    │         │         │            ┌──────────────────┐
                    │         │         └───────────►│ Redis            │  sessions, rate
                    │         │                      │                  │  limits, queues
                    │         ▼                      └──────────────────┘
                    │  ┌───────────────────────────────────────────────┐
                    │  │ Provider adapters (integrations/*)            │
                    │  │ Razorpay · RazorpayX · Stripe · Adyen ·       │
                    │  │ UPI/bank partner · intl payout partner ·      │
                    │  │ PPI partner · FX provider · KYC/AML provider  │
                    │  │ Zerodha Kite Connect · DriveWealth            │
                    │  └──────────────▲────────────────────────────────┘
                    │                 │ signed webhooks (verified, raw body)
                    ▼                 │
           Private object storage (KMS-encrypted, no public access)
           Email / SMS / push providers      Sentry · OpenTelemetry
```

Every outbound provider call goes through its adapter. Every inbound webhook is verified against the provider's signature, stored raw, and then processed idempotently by a worker.

---

## 4. Technology decisions

| Area | Choice | Reason |
|---|---|---|
| Web | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Recharts | Required by spec. Server components keep secrets off the client. |
| Mobile | Expo (managed workflow), React Native, expo-router, TypeScript | One codebase for iOS and Android. OTA updates for non-native fixes. Native modules only where needed (biometrics, secure store). |
| Admin | Next.js, same design system, separate deployment | Separate attack surface. Reachable only from the private network. |
| API | NestJS on Node.js 22 LTS, REST under `/v1`, OpenAPI via `@nestjs/swagger` | Modular structure suits a regulated domain. OpenAPI generates the client types. |
| Realtime | WebSocket gateway (Socket.IO via `@nestjs/platform-socket.io`) | Notifications and order-status updates. Auth on connect. |
| Database | PostgreSQL 16, Prisma ORM | Strong transactions, constraints and row-level controls for the ledger. |
| Cache, rate limit, sessions | Redis 7 | Fast OTP and rate-limit counters, session revocation list, short-lived idempotency locks. |
| Background jobs | BullMQ on Redis | Webhook processing, reconciliation, notification fan-out, retries with backoff. |
| Money | `BigInt` minor units plus a currency table | Exact arithmetic. No float rounding errors. |
| Hashing | Argon2id for passwords. HMAC-SHA256 for stored OTP and refresh-token digests. | Current OWASP guidance. Tokens never stored in plain text. |
| 2FA | TOTP (RFC 6238), recovery codes stored hashed | Works offline and with standard authenticator apps. SMS OTP is a fallback, not the primary factor. |
| Field encryption | Envelope encryption: AWS KMS data keys with AES-256-GCM per record | Encrypts PAN, passport numbers, dates of birth and addresses at rest. |
| Files | Private S3 bucket (AWS Hong Kong region `ap-east-1` as default; **OPEN**), SSE-KMS, short-lived presigned URLs | Identity documents never public. Access logged. |
| Web hosting | Vercel for `apps/web` | Required by spec. Only the public customer site runs there. |
| API and admin hosting | AWS (ECS Fargate to start; EKS later if needed) behind a WAF | Admin and API need VPC networking, private subnets and fine-grained IAM. |
| Monitoring | Sentry (errors), OpenTelemetry to CloudWatch or Grafana (traces, metrics), pino (structured logs, PII redacted) | Spec requires Sentry. |
| CI/CD | GitHub Actions: lint, typecheck, unit, integration (Postgres and Redis service containers), security scan, container build, staged deploy | Standard and auditable. Production deploy needs manual approval. |
| Monorepo tooling | pnpm workspaces and Turborepo | Fast installs and cached builds across apps and packages. |

---

## 5. Backend modules and request flow

Each NestJS module in `apps/api` is a thin HTTP adapter over one `services/*` package. A request follows the same path:

```
HTTP request
 → helmet, CORS allow-list, body-size limit, request id
 → rate limiter (Redis, per IP and per user)
 → JWT guard (access token, device and session check against Redis revocation set)
 → RBAC guard (customer scopes or admin role + permission)
 → DTO validation (class-validator, strict whitelist, reject unknown fields)
 → service (business rules, may open one DB transaction)
 → ledger write (if money moves) inside the same transaction
 → audit log row (same transaction)
 → outbox row for events (notification, webhook, search index)
 → response (no internal ids leaked, no PII beyond what the screen needs)
```

**Transactional outbox.** Events are written to an `OutboxEvent` table in the same transaction as the state change. A relay worker publishes them to BullMQ. This avoids "the database changed but the notification never sent" failures.

**Idempotency.** Every mutating endpoint that moves money or places an order requires an `Idempotency-Key` header (UUIDv4). The key is stored with a hash of the request body and the response. Replays return the stored response. The same key with a different body returns `409`.

---

## 6. Money and currency model

- Currencies in the first release: **HKD, USD, INR, EUR, GBP, AED, SGD, CNY**. All use 2 minor-unit digits, which keeps the code simple. Adding a currency with a different exponent (for example JPY with 0) is a data change plus a test, not a code change.
- Currency metadata lives in `packages/shared` and in a `Currency` table: `code`, `minorUnitExponent`, `displayName`, `symbol`, `isEnabled`.
- Formatting uses `Intl.NumberFormat` on the client only. The server returns `amountMinor` (string-encoded `BigInt`) and `currency`. It never returns floats.
- Exchange rates are **never hard-coded**. A rate is an `FxQuote` row from the approved FX provider with `rate`, `provider`, `quotedAt`, `expiresAt`, `serviceFeeMinor`, and `recipientAmountMinor`. Quotes expire (default 30 seconds for previews; execution uses the quote's lock or re-quotes with user consent).
- Rounding rule: the provider's rounding is authoritative for the executed amount. Our displayed preview rounds half-even and says so in the terms.

---

## 7. Financial ledger

The ledger is append-only and double-entry.

**Tables (Prisma names):**
- `LedgerAccount`: `id`, `ownerType` (customer wallet, customer trading cash, platform fee, suspense, provider settlement, FX position, reserve), `ownerId`, `currency`, `normalBalance` (debit or credit), `status`. Unique on `(ownerType, ownerId, currency, purpose)`.
- `LedgerTransaction`: `id`, `kind` (deposit, withdrawal, transfer, fx_conversion, fee, reversal, adjustment, trade_settlement), `status` (pending, posted, failed, reversed), `idempotencyKey` (unique), `providerRef`, `reversesTransactionId`, `createdBy`, `createdAt`, `postedAt`.
- `LedgerEntry`: `id`, `transactionId`, `ledgerAccountId`, `direction` (debit or credit), `amountMinor` (BigInt, always positive), `currency`, `createdAt`. No update or delete allowed.

**Invariants enforced in the database:**
1. Entries are immutable. A trigger rejects `UPDATE` and `DELETE` on `LedgerEntry` and `LedgerTransaction` once posted.
2. For each `LedgerTransaction` and each currency, the sum of debits equals the sum of credits. A deferred constraint trigger checks this at commit. Unbalanced postings cannot commit.
3. Each `LedgerEntry` currency matches its `LedgerAccount` currency.
4. A reversal creates a new transaction that references the original. It never edits the original.

**Balances.** `available`, `pending` and `total` balances are projections. They are maintained in a `LedgerBalance` table in the same transaction as the entries, and a nightly reconciliation job recomputes them from entries and alerts on any mismatch.

**Money state machine.** `pending` means the provider has accepted the instruction but has not confirmed it. Only a verified provider confirmation (webhook or status poll, with signature and reference matched) moves a transaction to `posted`, which is when the customer's balance changes. Failure or timeout moves it to `failed`, and any held funds are released through a reversing entry.

**Reconciliation.** Daily job: compare posted ledger totals per provider settlement account with provider settlement reports. Differences create a `ReconciliationRecord` in `open` status and a compliance or finance task. Nothing is auto-corrected silently.

**Adjustments.** Manual adjustments are a `kind = adjustment` request that requires maker-checker approval (section 12). No direct balance editing exists in any role.

---

## 8. Payment providers and transfers

### 8.1 Adapter contract

Every provider implements the same port in `services/payments`:

```ts
interface PaymentProviderAdapter {
  readonly id: ProviderId;                       // "razorpay" | "stripe" | ...
  capabilities(): ProviderCapabilities;           // country, currency, method, direction matrix
  createCollection(input: CollectionRequest, idem: IdempotencyKey): Promise<ProviderResult>;
  createPayout(input: PayoutRequest, idem: IdempotencyKey): Promise<ProviderResult>;
  getStatus(ref: ProviderRef): Promise<ProviderStatus>;
  refund(ref: ProviderRef, amountMinor: bigint, idem: IdempotencyKey): Promise<ProviderResult>;
  verifyWebhook(rawBody: Buffer, headers: Record<string,string>): WebhookEvent; // throws if invalid
}
```

`ProviderCapabilities` is data, not code. It is loaded from the `PaymentProvider` and `ProviderCapability` tables. Example rows: `(razorpay, IN, INR, upi, collection, enabled)`. Routing picks a provider only where a row is enabled for the exact corridor, method and direction. **Never assume one provider covers every country or method.**

### 8.2 Webhooks

1. Route accepts the raw body (body parser configured per route to keep the buffer).
2. Signature verified with the provider's secret using constant-time comparison. Timestamp tolerance enforced where the provider sends one.
3. Event stored in `ProviderWebhook` with a unique `(providerId, providerEventId)`. A duplicate is acknowledged and ignored.
4. Response `200` returned quickly. Processing happens in a BullMQ worker.
5. The worker re-fetches the object's status from the provider API before changing money state. A webhook alone is not trusted to move money.

### 8.3 Transfer flows

- **Internal transfer (HK FinHub user to HK FinHub user).** Ledger-only, instant, same-currency or with an FX quote. Still requires OTP or step-up auth.
- **Domestic bank transfer.** Provider payout (for example RazorpayX for India) to a verified beneficiary. Status: `pending` → `posted` or `failed`.
- **International transfer.** Quote from FX provider → customer confirms → authenticated → payout via approved international partner. Show FX rate, provider, timestamp, service fee and final recipient amount before confirmation.
- **Receive money.** Payment request with a unique reference, a QR code and a payment link. Funds count only when the collection is confirmed by the provider.
- **Deposits and withdrawals.** Through the provider's hosted or SDK flow. The platform never sees card numbers.

**Production gate.** Each flow checks `FEATURE_LIVE_*` and a `ProviderApproval` row (contract reference, approval date, approved corridors, approved by a Super Admin). If either is missing, the flow returns a clear "not yet available" response and the UI shows a sandbox banner.

---

## 9. Investments and brokers

- **Securities accounts are opened by the broker, not by HK FinHub.** The `InvestmentAccount` table stores the broker's account reference, status and permissions. It is never presented as a demat account unless the broker confirms that status.
- **India:** SEBI-registered broker and depository participant partner. Zerodha Kite Connect is one option where the customer is eligible. Eligibility, API terms and data-use limits are confirmed in writing before build.
- **US, Hong Kong and other markets:** DriveWealth or another approved brokerage infrastructure provider. Market coverage comes from the partner's list, not ours.
- **Order flow:** customer submits an order → risk and compliance checks (limits, restricted lists, KYC status) → order sent to the broker adapter with an idempotency key → broker status updates via webhook or polling → `Order` and `Trade` rows updated → trade settlement posted to the ledger as `trade_settlement` → `Holding` recalculated from broker-confirmed trades.
- **Holdings and P&L** come from broker data. `PortfolioSnapshot` rows are written daily and store the market value and cash component separately, so the dashboard can distinguish cash balances from investment valuations.
- **Market data:** shown only from licensed sources delivered by the broker or a market-data vendor. Each quote shows its source and timestamp. Delayed data is labelled as delayed.
- **Charts** use Recharts with data from the API. No simulated price series are shown as real.

---

## 10. Authentication, sessions and devices

- **Registration:** email and phone (E.164 format, country picked from a list) → verify both with one-time codes → set password → optional 2FA enrolment.
- **Passwords:** Argon2id (memory cost tuned to about 50 ms on production hardware), minimum length 12, breached-password check against a k-anonymity API or a local list.
- **OTP:** 6 digits, 5-minute expiry, stored as HMAC, max 5 attempts, rate-limited per destination and per IP. Delivery via the SMS or email provider chosen in Phase 4 (**OPEN**).
- **2FA:** TOTP required for money movement by default. Recovery codes (10, single-use, hashed) issued at enrolment.
- **Sessions:** short-lived access token (15 minutes, JWT, `sub`, `sid`, `dev`), refresh token (30 days, rotated on every use, reuse of an old token revokes the whole session family). Refresh tokens are stored hashed and bound to a device id.
- **Web:** refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. A CSRF token is required on state-changing requests. Access token kept in memory only.
- **Mobile:** refresh token in the platform secure store (iOS Keychain, Android Keystore via `expo-secure-store`). Biometric unlock via `expo-local-authentication` gates the app and step-up actions. Biometric data never leaves the device.
- **Device management:** every device is listed with its last-used time and location (country level). Users can revoke any device. A new device triggers a security notification and, for high-risk actions, step-up authentication.
- **Admin sessions:** separate issuer and audience, mandatory TOTP, IP allow-list, idle timeout 15 minutes, and no admin token accepted by customer endpoints.

---

## 11. KYC and compliance

- **KYC states:** `not_started` → `documents_pending` → `under_review` → `verified` | `rejected` | `additional_info_required`, with `expired` and `suspended` as later states. Stored in `KYCRecord`. Each change writes an audit row.
- **Identity:** an authorised KYC provider (**OPEN**) runs document and liveness checks. The platform stores the provider's reference, the result and the reason codes.
- **PAN verification (India):** through an authorised provider where applicable. The PAN is encrypted at rest and shown masked (last four digits).
- **Passport and address:** document upload to the private bucket through a presigned URL. A `KYCFile` row stores the object key, SHA-256 checksum, MIME type, size, and an encrypted metadata blob. Virus scan before the document is visible to staff.
- **AML and sanctions screening:** run on onboarding, on each beneficiary, and on each transfer above a threshold. Matches create a `ComplianceCase` and block the transaction until a compliance admin clears it.
- **Limits:** per-customer limits by tier (daily, monthly, per-transaction) and by corridor. Stored in configuration tables with maker-checker for changes.
- **Suspicious activity:** rule-based alerts first (velocity, new beneficiary plus large amount, device change plus payout, structuring near thresholds). Each alert becomes a `ComplianceCase`. Model-based scoring can come later.
- **Retention:** identity records retained for the period required by the applicable regulator. Retention periods are **OPEN** and set per jurisdiction.

---

## 12. Admin panel and maker-checker

- **Roles:** Super Admin, Finance Admin, Compliance Admin, Support Admin. Permissions are rows in `Permission`, mapped through `Role` and `AdminUser`. Checked on the server for every endpoint, never only in the UI.
- **Modules:** the 20 modules in the spec map to `apps/admin` routes and to `apps/api/src/admin/*` endpoints. Module-to-permission mapping is in the Phase 9 plan.
- **Maker-checker:** any sensitive action (balance adjustment, limit change, provider configuration, beneficiary override, user block or unblock, KYC override) creates an `ApprovalRequest` with status `pending`. A different admin with the required permission approves or rejects. The maker cannot approve their own request. The approved action is executed by the service and logged with both identities.
- **Audit log:** append-only `AuditLog` rows for every read of sensitive data (identity documents, full account numbers) and every write. Logs are shipped to a separate, write-only sink.
- **Least exposure:** the admin app shows masked identifiers by default. Revealing the full value is a logged action that needs a reason code.

---

## 13. Notifications and realtime

- **Channels:** email, SMS, push (Expo push for mobile; FCM and APNs behind it), and in-app. Providers are chosen in Phase 4 (**OPEN**).
- **Events:** login, new device, payment received, transfer completed, transfer failed, withdrawal, KYC status change, trade executed, security alert. Each event has a template per channel and locale.
- **Preferences:** the user chooses channels per category. Security alerts cannot be turned off for email and push.
- **Delivery:** outbox → BullMQ → channel adapter. Retries with exponential backoff. Dead-letter queue for manual review.
- **WebSocket:** authenticated on connect with the same access token. Rooms per user. Only status changes (transfer, order, KYC) are pushed. Full records are fetched over REST.

---

## 14. Security controls

| Spec requirement | Control |
|---|---|
| Encryption at rest and in transit | TLS 1.2+ everywhere (HSTS on web). RDS and S3 encrypted with KMS. Field-level envelope encryption for PII and KYC data. |
| Secure authentication | Argon2id, TOTP, short-lived access tokens, rotating refresh tokens, device binding. |
| RBAC | Customer scopes and admin roles and permissions, enforced server-side. |
| Rate limiting | Redis-backed limits per IP, per user and per endpoint class (login, OTP, transfer). |
| CSRF protection | SameSite cookies plus CSRF token on cookie-authenticated state changes. |
| Input validation | Strict DTO validation, body-size limits, allow-lists for enums and currencies. |
| SQL injection | Prisma parameterised queries only. Raw SQL reviewed and tested. |
| XSS | React escaping, strict Content-Security-Policy, no `dangerouslySetInnerHTML` on user content. |
| Webhook verification | Per-provider signature check on raw body, timestamp tolerance, idempotent storage. |
| Fraud monitoring | Rule engine (section 11) and device and velocity signals. |
| Audit logging | Append-only audit table, separate sink. |
| Secrets management | AWS Secrets Manager, KMS. Nothing in git. Secret scanning in CI. Rotation runbook. |
| Backup and DR | RDS automated backups with point-in-time recovery, cross-region snapshot copy, restore drill each quarter. RPO 5 minutes, RTO 4 hours (targets, to be agreed). |
| Security testing | SAST (CodeQL or Semgrep), dependency audit, DAST against staging, annual third-party penetration test before production. |
| Card and bank secrets | Not collected. Provider-hosted screens only. |

---

## 15. Open decisions and required inputs

These block specific phases. They are not blockers for Phase 1 or Phase 2.

| # | Decision or input | Needed by | Owner |
|---|---|---|---|
| D1 | Launch jurisdictions and the legal entity that holds each licence or contract | Phase 6 | Business and legal |
| D2 | KYC and AML screening provider(s) | Phase 7 | Compliance |
| D3 | FX rate provider | Phase 6 | Finance |
| D4 | UPI and bank partner for India | Phase 6 | Finance |
| D5 | International payout partner | Phase 6 | Finance |
| D6 | Authorised wallet or PPI partner, if the product needs stored value | Phase 5 | Legal |
| D7 | Razorpay, RazorpayX, Stripe and Adyen merchant accounts, sandbox and production approvals | Phase 6 | Finance |
| D8 | Zerodha Kite Connect eligibility and API agreement | Phase 8 | Investments |
| D9 | DriveWealth or alternative brokerage agreement and market list | Phase 8 | Investments |
| D10 | Market-data licences for displayed quotes | Phase 8 | Investments |
| D11 | Hosting region (AWS `ap-east-1` assumed) and data residency rules | Phase 12 | Engineering and compliance |
| D12 | SMS, email and push provider accounts | Phase 4 | Engineering |
| D13 | Sentry project and DSN | Phase 4 | Engineering |
| D14 | Authentication approach: in-house (recommended here) or managed identity provider | Phase 4 | Engineering |
| D15 | Retention periods for identity and transaction records | Phase 7 | Compliance |
| D16 | Brand assets: final logo files and font licences (current mock-ups are illustrative) | Phase 2 | Design |

**Credentials to supply later** are listed in `.env.example`. None are needed for Phases 1 to 3.

---

## 16. Data model overview

Grouped by domain. Full Prisma schema in Phase 4 and 5.

- **Identity:** `User`, `UserProfile`, `Device`, `Session`, `RefreshToken`, `OtpChallenge`, `TwoFactorMethod`, `RecoveryCode`.
- **Accounts and money:** `Account`, `CurrencyAccount`, `Wallet`, `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `LedgerBalance`, `Beneficiary`, `Payment`, `Payout`, `Transfer`, `FXQuote`, `Currency`, `LimitProfile`.
- **Providers:** `PaymentProvider`, `ProviderCapability`, `ProviderApproval`, `ProviderWebhook`, `ReconciliationRecord`, `OutboxEvent`.
- **KYC and compliance:** `KYCRecord`, `KYCFile`, `ComplianceCase`, `ScreeningResult`, `FraudAlert`.
- **Investments:** `InvestmentAccount`, `Holding`, `Order`, `Trade`, `PortfolioSnapshot`.
- **Notifications:** `Notification`, `NotificationPreference`, `NotificationDelivery`.
- **Admin and audit:** `AdminUser`, `Role`, `Permission`, `RolePermission`, `ApprovalRequest`, `AuditLog`, `IdempotencyKey`.

Each table has a primary key (UUID v7 for time ordering), explicit foreign keys, unique constraints on natural keys (provider event ids, idempotency keys, account references), and indexes on every foreign key and on columns used in admin filters.

---

## 17. Infrastructure and environments

| Environment | Purpose | Live money |
|---|---|---|
| `local` | Developer machines; Docker Compose for Postgres and Redis (`infrastructure/docker/docker-compose.dev.yml`) | Never |
| `sandbox` | Provider sandbox credentials, seeded test customers | Never |
| `staging` | Production-like, provider sandbox, pen-test target | Never |
| `production` | Live, after approvals in D1 to D10 | Only where `ProviderApproval` and feature flags allow |

- Deployment: container images built in CI, pushed to a private registry, deployed to ECS Fargate across two availability zones. Database on RDS PostgreSQL Multi-AZ. Redis on ElastiCache.
- Migrations run as a separate one-off task before the new version receives traffic. Migrations are forward-only and backward-compatible for one release.
- Secrets injected from Secrets Manager at task start. Rotation is documented in `docs/runbooks/` (Phase 12).

---

## 18. Testing strategy

| Layer | Tooling | Gate |
|---|---|---|
| Unit | Vitest (services, money helpers, ledger rules) | Every PR |
| Ledger property tests | fast-check: random postings always balance; reversals restore balances | Every PR |
| API integration | Supertest against Postgres and Redis containers | Every PR |
| Provider adapters | Recorded sandbox fixtures and webhook signature vectors | Every PR |
| Contract | OpenAPI diff check; breaking changes need a version bump | Every PR |
| Web and admin E2E | Playwright (Chromium), at phone and desktop widths | Before staging deploy |
| Mobile E2E | Maestro on iOS and Android simulators | Before release |
| Security | Semgrep or CodeQL, `pnpm audit`, secret scanning, DAST on staging | Nightly and before release |
| Sandbox transactions | Scripted end-to-end flows against provider sandboxes | Phase 11 |

---

## 19. Architecture decision records (summary)

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Modular monolith with framework-agnostic `services/*` and provider `integrations/*` | Accepted |
| ADR-002 | Ledger as the sole source of money state, `BigInt` minor units, DB-enforced immutability | Accepted |
| ADR-003 | No balance changes before provider confirmation | Accepted |
| ADR-004 | Production features disabled by default; flag plus approval record required | Accepted |
| ADR-005 | Provider capabilities stored as data, not hard-coded | Accepted |
| ADR-006 | Admin app deployed separately on a private network | Accepted |
| ADR-007 | In-house authentication on NestJS (D14 may reverse this) | Accepted for Phase 4 |
| ADR-008 | Web on Vercel, API and admin on AWS | Accepted |
| ADR-009 | Transactional outbox for events | Accepted |
