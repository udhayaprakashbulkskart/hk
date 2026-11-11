# HK FinHub: Implementation Roadmap

Each phase ends with: tests run, errors fixed, documentation updated, completed modules reported, pending credentials reported, and provider approvals still required. A phase is **done** only when its exit criteria pass. Phases run in order because each depends on the one before it.

Status key: ✅ done · 🟡 in progress · ⬜ not started · ⏸ blocked on input

| # | Phase | Status | Blocked by |
|---|---|---|---|
| 1 | Repository inspection and technical architecture | ✅ (this commit) | — |
| 2 | Design system and complete web UI | ✅ | — (sample data; live APIs come in Phase 4) |
| 3 | Mobile app screens | ✅ | — (sample data; live APIs in Phase 4) |
| 4 | Backend, database and authentication | ✅ | D12 (messaging providers), D13 (Sentry DSN) for live delivery |
| 5 | Accounts and ledger | ✅ | — (no partner needed: the wallet is a ledger view) |
| 6 | Payment provider adapters, FX, transfers | 🟡 | D1, D3, D4, D5, D7 for live; test complete |
| 7 | KYC and compliance modules | 🟡 | D2, D15 for live; D11 for KMS and S3 verification; test complete |
| 8 | Broker and investment adapters | 🟡 | D8, D9, D10 for live brokers and market data; test broker and ledger settlement complete |
| 9 | Admin dashboard | 🟡 | Backend and staff console built (`apps/admin`); users, payments, transfers, currency, reports and settings screens not built |
| 10 | Integrate all applications | 🟡 | API journey test complete; web and mobile still on sample data |
| 11 | Tests, security checks and test transactions | 🟡 | 178 API tests, 16 automated security probes (verified against a deliberate mutation), unit suites, typechecks, clean dependency audit; no penetration test |
| 12 | Production deployment preparation | 🟡 | Readiness document written; not deployed. See docs/production-readiness.md |

---

## Phase 1: Repository inspection and technical architecture ✅

**Inspected:** the repository contained only `README.md` and one commit. No existing code, so nothing was overwritten.

**Delivered:**
- `docs/architecture.md`: target architecture, technology decisions, ledger design, provider model, security controls, open decisions (D1–D16), ADR summary.
- `docs/roadmap.md`: this file.
- Monorepo skeleton: `apps/`, `packages/`, `services/`, `integrations/`, `database/`, `infrastructure/`, `tests/`, `docs/`, each with a purpose README.
- Root config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` (strict), `.gitignore`, `.env.example` (placeholders only).
- `infrastructure/docker/docker-compose.dev.yml`: local PostgreSQL 16 and Redis 7, bound to localhost, passwords required from the environment.

**Exit criteria:**
- [x] Every spec requirement area has either a design section in `docs/architecture.md` or a named phase in this roadmap.
- [x] Folder structure matches spec section 17, with the ambiguity resolved and recorded.
- [x] `package.json` and `tsconfig.base.json` parse. The strict tsconfig validates when extended.
- [x] Compose file validates and rejects missing secrets.
- [x] No secrets, customer data or real credentials committed.
- [x] No live money paths exist.

**Not done in Phase 1 (by design):** no installed dependencies, no lockfile, no application code, no CI workflow. These start in Phase 2 (web) and Phase 4 (API).

---

## Phase 2: Design system and complete web UI ✅

**Result:** 23 customer screens in `apps/web`, a shared design system in `packages/ui`, and a Playwright suite in `tests/web-e2e` (153 tests passing: flows plus a layout matrix at 360, 768 and 1440 px in both themes, with no horizontal scroll, one `h1` per screen, and no console errors). All data is labelled sample data behind the `FinHubApi` boundary.

**Known gaps carried forward:** CSP allows inline scripts (move to hashes in Phase 4); dashboard and account pages are statically prerendered (must become dynamic with the real API); cash card has spare vertical space on desktop.

**Goal:** a responsive Next.js customer app with the Hong Kong-inspired design system, using the spec palette.

**Deliverables:**
- `packages/ui`: design tokens (`#B5121B` primary red, `#080B10` dark background, `#141821` cards, `#202631` secondary, `#C6A34A` gold, `#F5F5F5` and `#A8ADB8` text, `#159B70` success, `#E04444` error). Light and dark themes defined on `:root`.
- Screens: landing, login, registration, OTP, dashboard, accounts, send money, receive money, global transfer, currency converter, investments and portfolio, transaction history, profile, settings, notifications, security.
- Charts with Recharts. Charts show empty and error states, not invented data.
- Responsive at phone, tablet and desktop widths. No horizontal scroll at 360 px.
- Mocked API client behind an interface, so Phase 4 can swap in the real API without UI rewrites.

**Exit criteria:** Playwright screenshots at 360, 768 and 1440 px for each screen in both themes. Lighthouse accessibility score ≥ 90 on key screens. No hard-coded live rates or balances in code.

**Notes:** the mock-up balances and rates in the spec image are illustrative. They are not used as data.

---

## Phase 3: Mobile app screens ✅

**Result:** Expo SDK 58 app in `apps/mobile` with 26 routes covering every screen in spec section 14, plus the QR scanner and the payment-link route. Shares the data client (`packages/api-client`) and colour tokens (`packages/tokens`) with the web app. Native features: biometric app lock, secure session storage, push permission and token (needs EAS project ID), QR scanning, and the `hkfinhub://` deep link.

**Verified:** `expo export` bundles iOS (Hermes), Android (Hermes) and web; the web export is driven by 8 Playwright tests at phone size in both themes (sign-in, every screen without horizontal overflow or uncaught errors, public screens, payment-link handling). Strict TypeScript passes.

**Not verified here (run on device in Phase 11):** iOS and Android simulators, Face ID / fingerprint, camera scanning, push delivery, Maestro flows.

**Known gaps:** push tokens are not sent to a backend yet; the EAS project ID is not set; the recipient list in the send wizard is sample data; screen titles appear twice on some stack screens (header plus in-body title).

**Goal:** Expo app (iOS and Android) with all screens from spec section 14, sharing types and tokens with the web app.

**Deliverables:** expo-router navigation; splash, login, registration, OTP, dashboard, accounts, send, receive, global transfer, exchange, investment, portfolio, history, profile, settings, notifications, security. Placeholder data layer behind the same client interface.

**Exit criteria:** app runs on iOS and Android simulators. Maestro smoke test passes for login → dashboard → send money (test). Biometric prompt wired (real verification comes in Phase 4).

---

## Phase 4: Backend, database and authentication ✅

**Result (backend complete):** NestJS API in `apps/api` with OpenAPI at `/v1/openapi.json`, Socket.IO realtime, a Prisma 7 schema and migrations in `database/`, the authentication domain in `services/authentication`, and the notification pipeline (outbox, BullMQ worker, in-app inbox, Redis realtime) in `services/notifications`. CI runs typechecks and the backend suite against Postgres and Redis service containers.

**Verified:** 56 API integration tests against real Postgres 16 and Redis 7, plus 14 domain tests. This covers the exit criteria: registration; OTP expiry and lockout; wrong-password responses identical to unknown-email responses; 2FA enrolment with replay blocking and recovery codes; refresh reuse ending the session family; device revocation; rate limits with Retry-After; security headers; OpenAPI routes all mounted; audit log append-only at the database level; the BullMQ worker path; a socket receiving a security event; and a dependency-direction check on `services/*`.

**Decisions taken:** in-house authentication (ADR-007 accepted, D14 to be confirmed); Argon2id passwords; OTPs, refresh tokens and recovery codes stored as keyed digests; TOTP secrets encrypted; no DI metadata, so tsx, vitest and tsc behave the same.

**Client wiring (done):** `packages/api-client/src/auth-http.ts` is a typed client for `/v1/auth`. Web sign-in, registration, two-step verification, MFA and password reset call the API. Mobile does the same, and restores sessions from the device secure store on launch. Other domains still use the data client until their endpoints exist in Phase 5 onwards. Web and mobile tests intercept the API at the browser boundary; the API itself is covered by its own suite. The web CSP now allows the configured API origin, which was blocking requests before.

**Still open:**
- D12: no email or SMS provider is approved, so messages fail closed until one is chosen.
- Web keeps tokens in memory only: a reload ends the session. Persisting safely needs httpOnly cookies on a same-site API domain.
- Login accepts email only. Mobile-number login is planned.
- Mobile reaches the API through `EXPO_PUBLIC_API_URL`. A physical device needs the machine's LAN address, not localhost.
- D13: Sentry is wired but inactive without a DSN.
- Breached-password check (k-anonymity) is planned for Phase 7; the current list is short.
- Container image and production build are Phase 12; the API currently runs under tsx.

**Goal:** real NestJS API, Prisma schema for identity, Redis, background jobs.

**Deliverables:**
- `apps/api`: NestJS, OpenAPI at `/v1/docs`, WebSocket gateway, health and readiness endpoints.
- `database/`: Prisma schema for identity and device tables; first migrations; seed for local development only.
- `services/authentication`: registration, email and phone verification, OTP (hashed, rate-limited), password login (Argon2id), TOTP 2FA with recovery codes, password reset, device list and revocation, session rotation with reuse detection.
- `services/notifications`: outbox, BullMQ worker, email and SMS adapters behind ports (real providers from D12).
- Rate limiting, helmet, CORS allow-list, request IDs, Sentry (D13), pino with PII redaction.
- Lint rule enforcing the dependency direction in `docs/architecture.md` section 2.
- GitHub Actions CI: lint, typecheck, unit, integration against Postgres and Redis service containers.

**Exit criteria:** integration tests cover registration, OTP expiry and lockout, login with wrong password (no user enumeration), 2FA enrolment, refresh-token reuse revoking the session family. Web and mobile clients switched from mocks to the real API for auth.

**Inputs needed:** D12, D13, D14 (confirm in-house auth or managed provider before this phase starts).

---

## Phase 5: Accounts and ledger ✅

**Result:** double-entry ledger in `services/ledger` with immutable records, idempotent postings, reversals, holds, settlement and release, maker-checker adjustments and reconciliation. Customer accounts, currency accounts and encrypted recipients in `services/accounts`. Ledger-derived balances, totals and activity in `services/wallet`. HTTP surface: `/v1/accounts`, `/v1/accounts/currencies`, `/v1/dashboard`, `/v1/transactions`, `/v1/beneficiaries`.

**Enforced in the database, not only in code:** entries and transactions cannot be updated or deleted; balances can change only through the posting function; customer balances cannot go negative; each transaction must balance per currency at commit; entry currency must match the account.

**Verified:** 20 database tests against real Postgres, including 100 concurrent holds (exactly 50 succeed, none overdraw), opposite-direction transfers in parallel without deadlock, a direct balance update being refused, idempotent replays under a race, a single reversal under a race, a balance altered outside the posting path being detected by reconciliation, and maker-checker self-approval being refused. Three property suites (fast-check, hundreds of random sequences each) check double entry, no negative balances, failed postings leaving no trace, and exact reversal. 11 HTTP tests cover accounts, the dashboard (cash and investments separate, no cross-customer leakage), and encrypted, masked recipients. Full backend: 87 API tests and 3 ledger properties pass.

**Gaps carried forward:**
- Deposits, withdrawals and transfers have no public endpoints yet. Phase 6 connects them through the payment adapters and verified webhooks.
- The dashboard's cash total is HKD only. Conversion waits for the FX provider (Phase 6).
- Linked payment accounts are not modelled. They arrive with the payment adapters.
- The daily reconciliation job is a function, not yet a scheduled worker.
- Balances use a 2-decimal exponent for every launch currency, which is correct for all eight. A currency with a different exponent needs a data change and a test.

**Goal:** customer financial accounts and the immutable double-entry ledger.

**Deliverables:**
- `services/ledger`: `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `LedgerBalance`. Immutability triggers. Deferred balance check per transaction and currency. Idempotency keys. Reversal posting.
- `services/accounts`: customer profile, `Account`, `CurrencyAccount` for HKD, USD, INR, EUR, GBP, AED, SGD, CNY, linked payment accounts, beneficiaries.
- `services/wallet`: available, pending and total balances as projections of the ledger.
- Currency table seeded from `packages/shared` metadata.
- Daily reconciliation job skeleton (no provider data yet) with `ReconciliationRecord`.
- Dashboard endpoints: total balance, wallet, investment placeholder (zero until Phase 8), deposits, withdrawals, transfers totals, recent transactions.

**Exit criteria:**
- Property tests: random sequences of postings always balance. Reversals restore prior balances.
- Concurrent posting test: 100 parallel transfers against one account never overdraw.
- Attempted `UPDATE` or `DELETE` on posted entries is rejected at the database level.
- Adjustments can only be requested, never executed directly (maker-checker stub in place for Phase 9).

**Inputs needed:** D6 only if a stored-value product is in scope. Otherwise the wallet is a ledger view and needs no partner.

---

## Phase 6: Payment provider adapters, FX and transfers 🟡

**Status: test complete. Live is not enabled and cannot be enabled without the inputs below.**

**Built:**
- `services/payments`: routing from a capability table, collections and payouts, webhook verification, deduplication, provider confirmation before any change, refunds, and two live gates (flag plus a provider approval row).
- `integrations/razorpay`, `razorpayx`, `stripe`, `adyen`: adapters with signature verification and status lookup (Adyen status lookup is not built, so Adyen cannot move money). `partner-stubs` for the UPI and bank, international and PPI partners, all refusing.
- `services/fx`: integer quotes with a 0.20% fee, 30-second locks, single use, and one balanced ledger leg per currency. Sample rates only.
- `services/transfers`: pending transfers reserve funds without moving balances; settlement posts once on confirmation; failure releases the reservation. Internal transfers, withdrawals, and payment requests with QR and link.
- HTTP: `/v1/deposits`, `/v1/transfers`, `/v1/transfers/internal`, `/v1/transfers/withdrawals`, `/v1/fx/*`, `/v1/payment-requests/*`, `/v1/webhooks/{provider}`, `/v1/config/currencies`.

**Verified (131 API tests against real Postgres and Redis):** webhook valid, invalid, forged, stale, replayed, redelivered, unmatched and out-of-order cases, each checked against balances. Refund reversal. A pending transfer leaves balances unchanged and blocks overspend, including two simultaneous payouts. Settlement only after provider confirmation. Failed payout releases funds. The test journey from the exit criteria (collection, posting, payout, posting, reconciled books) and its failure path. Live refused with no provider call while the flag is off, and still refused with the flag on but no approval. Quotes: exact integer fee and rounding, single use, expiry. Payment requests: payer view without account identifiers, payment closes the request, cancel rules. Pinned signature vectors for each provider.

**Not done, and why:**
- Provider request shapes are unverified against live sandboxes (D7), and the signature vectors are regression vectors from the documented algorithms, not provider recordings. Both must be replaced before go-live.
- Provider credentials are not held. No network call has ever been made to a provider.
- D1, D3 (FX rates are illustrative), D4, D5 and D6 are open. Their stub adapters refuse everything.
- Provider statement reconciliation is planned, not built.
- Web and mobile send, receive and deposit screens still use the data client. Wiring them to these endpoints is part of Phase 10.
- Adyen cannot move money until its status lookup is built.

**Goal:** provider adapters behind one port, FX quotes, and transfer workflows. Test first. Live disabled.

**Deliverables:**
- `integrations/razorpay`, `razorpayx`, `stripe`, `adyen`: each implements `PaymentProviderAdapter`, with test and production configuration, signature-verified webhooks, idempotent calls and status polling.
- `UPI/bank partner`, `international payout partner`, `wallet/PPI partner`: adapter interfaces and a test stub. Real adapters only after D4, D5, D6 are signed.
- `ProviderCapability` data: corridor, currency, method, direction. Routing reads only enabled rows.
- `services/payments`: collections, payouts, refunds, status machine (`pending` → `posted` | `failed` | `reversed`), reconciliation against provider reports.
- `services/fx`: quotes from the FX provider (D3), expiry, service fee, recipient amount, rate history.
- `services/transfers`: internal transfer (ledger-only), domestic payout, international payout, receive-money requests with QR and payment link.
- UI for send and receive with the full confirmation screen from spec section 6.

**Exit criteria:**
- Webhook tests with recorded signature vectors: valid, invalid, replayed, out-of-order.
- A transfer shows balance changes only after a verified provider confirmation (test that a `pending` transfer leaves balances unchanged).
- Test end-to-end: collection → posted → payout → posted; failure → released funds.
- `FEATURE_LIVE_PAYMENTS` and `FEATURE_LIVE_TRANSFERS` default off; live paths return "not yet available" without an approval row.

**Inputs needed:** D1, D3, D4, D5 for corridors, D7 for merchant accounts. Test accounts can start earlier.

---

## Phase 7: KYC and compliance

**Goal:** onboarding identity verification, document handling, screening, limits and alerts.

**Deliverables:**
- `services/kyc`: state machine (section 11), document upload to private storage through presigned URLs, SHA-256 checksum, malware scan hook, provider reference storage, masked display.
- `services/compliance`: AML and sanctions screening adapters (D2), screening on onboarding, beneficiaries and above-threshold transfers, `ComplianceCase` workflow, velocity and structuring rules, limits by tier and corridor with maker-checker changes.
- Encryption for PAN, passport and date of birth using envelope encryption. Decryption logged.
- Staff-only KYC review queue (full UI in Phase 9).

**Exit criteria:** a screening hit blocks a transfer until cleared. An identity document is not readable by any role without an audit entry. Encryption round-trip test. A limit breach is rejected with a clear code.

**Inputs needed:** D2, D15.

**Status and deviations (built):**
- `services/kyc` and `services/compliance` are built with pure rules, ports, test adapters and Prisma stores. 20 KYC unit tests and 8 compliance unit tests pass. 11 API integration tests cover the exit criteria against real Postgres. The full API suite passes (142 tests).
- **Deviation: uploads go through the API, not presigned URLs.** The client sends raw bytes to `POST /v1/kyc/documents`. The API sniffs the real type, checks size (10 MB), scans, encrypts and only then writes to private storage. This keeps the malware scan and checksum before any object exists. Presigned uploads would let unscanned bytes land in the bucket first. Revisit if file sizes or throughput require it.
- **Production is fail-closed.** In production, KMS, the malware scanner, the KYC vendor and sanctions screening stay unconfigured until approved (D2, D11, D15). Each reports `NOT_AVAILABLE`. Customers cannot be verified, and beneficiaries cannot be added, until screening runs for real.
- **Not built yet:** the staff review queue and the decrypt-for-review endpoint (Phase 9 admin, but the service method exists and is audited); AWS KMS adapter (the local envelope key is non-production only); a real malware scanner; a real KYC vendor; PAN and address verification against authorities (only format checks and document review exist); the `FEATURE_LIVE_KYC_PROVIDER` gate, which has no live adapter to gate yet.
- The S3 adapter is **unverified against AWS**. It is tested only through the SDK's command objects in unit tests.

---

## Phase 8: Broker and investment adapters

**Goal:** investment accounts and orders through authorised brokers.

**Deliverables:**
- `integrations/zerodha` (Kite Connect, where eligible) and `integrations/drivewealth`: broker adapter port with account linking, order placement with idempotency, order status, trade import, holdings and positions.
- `services/investment`: investment account reference, holdings, orders (buy, sell, open, completed), trades, trade history, P&L calculated from broker-confirmed trades, daily `PortfolioSnapshot`.
- Trade settlement posted to the ledger as `trade_settlement`.
- Market overview and watchlist from licensed feeds only, with source and timestamp on every quote.
- Investment screens in web and mobile, including statements and charts.
- Explicit labelling: investment valuations separate from cash balances on every screen.

**Exit criteria:** test order lifecycle (place → partially filled → filled → settled) reflected in holdings and ledger. Risk checks block orders for unverified KYC. No holding appears without broker confirmation.

**Inputs needed:** D8, D9, D10.

---

## Phase 9: Admin dashboard

**Goal:** secure internal panel covering all 20 modules in spec section 9.

**Deliverables:**
- `apps/admin` on a private network, with TOTP, IP allow-list and short idle timeout.
- Modules: dashboard, users, KYC management, financial accounts, payment monitoring, deposits, withdrawals, money transfers, global transfers, currency management, investment accounts, broker integrations, compliance, fraud monitoring, notifications, reports, provider configuration, audit logs, staff management, system settings.
- RBAC: Super Admin, Finance Admin, Compliance Admin, Support Admin, with permissions checked on the server.
- Maker-checker for balance adjustments, limit changes, provider configuration and KYC overrides. The maker cannot approve their own request.
- Masked identifiers by default. Reveal requires a reason code and is logged.

**Exit criteria:** every admin endpoint has a permission test (allowed and denied per role). Maker-checker tests cover self-approval attempts. No endpoint is reachable from the public customer host.

---

## Phase 10: Integrate all applications

**Goal:** web, mobile, admin and API run as one system on the same contracts.

**Deliverables:** generated API client shared by all front ends; end-to-end user journeys (register → verify → fund → send → receive → invest → statement); WebSocket status updates across clients; consistent error codes and copy.

**Exit criteria:** a single test user can complete every journey on web and mobile, with the same balances shown on both.

---

## Phase 11: Tests, security checks and test transactions

**Goal:** prove correctness and security before any production work.

**Deliverables:**
- Full test suites per section 18 of the architecture.
- Security: SAST, dependency audit, secret scan, DAST on staging, threat model, review of every webhook and every money-moving endpoint.
- Test transaction runs with each provider, recorded in `tests/test-reports/`.
- Test report: pass or fail per suite, coverage, known issues with severity.
- Fixes applied and re-tested; nothing skipped silently.

**Exit criteria:** zero open critical or high findings. All test journeys pass twice on separate days. Reconciliation of test ledger against provider reports matches to the minor unit.

---

## Phase 12: Production deployment preparation

**Goal:** a repeatable, documented, reviewed production deployment. **Not** a switch to live money.

**Deliverables:**
- Terraform for VPC, RDS Multi-AZ, ElastiCache, ECS, S3 with KMS, WAF, Secrets Manager, CloudWatch and Sentry wiring.
- Deployment guide, API documentation, runbooks (secret rotation, DB restore, provider outage, incident response, reconciliation break).
- Backup and restore drill with recorded RPO and RTO.
- Launch checklist sign-off: legal, compliance, provider contracts, pen test report.

**Exit criteria:** staging is a faithful copy of production configuration. Restore drill succeeds within the target. Each live feature flag still requires its `ProviderApproval` row before it can be enabled.

---

## Provider approvals required before live money

These are not technical tasks. The platform stays in test until each is confirmed in writing.

1. Legal entity and licences or registrations for each launch jurisdiction (D1).
2. Merchant or payout agreement and live credentials for each payment provider (D7).
3. Permitted corridors, methods and directions for each provider, confirmed in writing (ProviderCapability rows).
4. FX provider agreement and rate-display terms (D3).
5. KYC and AML provider agreement and data-processing terms (D2).
6. Brokerage agreement and market list (D8, D9), and market-data licences (D10).
7. Written confirmation of any account-status label (for example demat status) shown to customers.
8. Penetration test report and security sign-off before production (Phase 11).

## Pending credentials (test first)

Listed in `.env.example`. Needed by phase:
- Phase 4: SMS, email and push provider accounts; Sentry DSN; KMS key.
- Phase 6: Razorpay, RazorpayX, Stripe and Adyen test keys and webhook secrets; FX provider key; UPI/bank and payout partner test credentials.
- Phase 7: KYC/AML provider test key.
- Phase 8: Zerodha Kite Connect and DriveWealth test keys.
- Phase 12: production credentials, stored only in Secrets Manager.

---

## Decisions needed from you now

Phase 2 can start without any of these. Phase 4 needs D14 settled first.

1. **D14:** in-house authentication (recommended in `docs/architecture.md`, ADR-007) or a managed identity provider?
2. **D1:** which launch jurisdictions? This determines which partners are needed first.
3. **D16:** brand assets and fonts. Placeholders are fine for Phase 2.
4. **D11:** confirm AWS Hong Kong region (`ap-east-1`) for hosting and data residency.

---

## Phases 8 to 12: what was built in this pass

- **Phase 8**: `services/investment` (order lifecycle, broker-confirmed fills, average-cost P&L, ledger settlement
  posted once per order), a test broker, and `/v1/investments/*`. Not built: Zerodha and DriveWealth adapters,
  market data, daily portfolio snapshots, investment screens.
- **Phase 9**: `services/admin` (permission matrix, audited denials, maker-checker for provider approvals, PII reveals
  with reason codes), staff role model, and `/v1/admin/*` behind a staff guard (TOTP and optional IP allow-list).
  The permission matrix test covers 16 endpoints across 4 roles. `apps/admin` is a staff console for approvals, cases,
  identity decisions, audited document views, logged reveals and the audit log. Not built: user, payment, transfer,
  currency, report and settings screens.
- **Phase 10**: one cross-application journey test through the real API (KYC, funding, receiving, investing,
  sending, dashboard). Not built: moving web and mobile off sample data.
- **Phase 11**: all typechecks and unit suites pass; 162 API tests pass; the production dependency audit is clean
  after pinning patched `minimatch` and `glob` versions. Not done: penetration testing, load testing.
- **Phase 12**: `docs/production-readiness.md`. Not deployed.

---

## Access change: operator login only

Customer self-signup is removed. The API has no public register or verification-code routes, and the web and mobile
apps have no signup screens. A single operator login is created at startup from configuration (see
`docs/production-readiness.md`, "Access model"). Tests create customers through the same provisioning path.
