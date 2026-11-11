# Production readiness (Phase 12)

Status: **not ready for production.** The code is test-complete for the flows in the brief. Nothing here is
live money. Every live path is refused by default and needs a human approval before it can be turned on.

## What is in place
- API: auth, accounts and ledger (double entry, database-enforced immutability and no-overdraft), payments
  (webhook verification, test adapters), FX and transfers (reservation model), KYC and compliance (encrypted
  identity fields, audited document reads, sanctions holds, limits), staff administration (server-side permission
  matrix, maker-checker, audited PII reveals), and investments (test broker, broker-confirmed fills only).
- Tests: 162 API integration tests against real Postgres and Redis, plus unit suites for KYC (20), compliance (8),
  admin (7), investment (11) and ledger (3). Every typecheck passes. Dependency audit: no known vulnerabilities.
- Database: Neon project `hk-finhub` (Postgres 16, Singapore) holds the full schema, with migrations recorded.
- Web: deployed to Vercel as a test build with sample data. SSO protection is on.

## Access model
- Customers cannot sign up. The public signup and verification-code routes are removed, and their screens are gone
  from the web and mobile apps.
- There is one operator login. It is created at API startup from `LOGIN_USER_EMAIL`, `LOGIN_USER_PHONE`,
  `LOGIN_USER_PASSWORD` and `LOGIN_USER_NAME`. Set all three together, or startup refuses. The password is never
  stored in the repository.
- The operator password must be changed from the one used during setup. It was shared in a chat, and the policy
  minimum is only 12 characters. Use a long, random passphrase in the secrets manager.
- Admin console access also requires a staff role and confirmed two-factor authentication. The login password alone
  does not open it.

## Resolved in this pass
- Neon owner password rotated. The previous credential is verified as rejected.
- Vercel deployment protection set to SSO for all deployments.
- Security probe extended: refresh-token confusion, and forgery reusing a real session and user (verified to fail when signature checking is disabled).

## Blockers (in order of who must act)
| Blocker | Why it blocks | Owner / decision |
|---|---|---|
| Provider contracts and approvals (payments, payouts, FX) | Live money cannot move without them | D1, D3 to D5, D7 |
| KYC and screening vendor | Identity checks and sanctions screening return NOT_AVAILABLE in production | D2 |
| AWS KMS adapter, verified | Local envelope key is refused in production | D11 |
| Malware scanner | Document uploads refused in production until a real scanner exists | D15 |
| Broker contracts (Zerodha, DriveWealth) | Investments refused in production | D8 to D10 |
| Licensed market-data feed | No quotes or market values are shown | D9 |
| Admin screens not yet built | `apps/admin` covers approvals, cases, identity, reveals, customers, payments, transfers, reconciliation, currencies, settings and audit. Still missing: staff management, provider request screen, fraud monitoring, notifications | Build work |
| Web and mobile on the real API | Both still use sample data. The web data boundary has no real endpoint for market quotes, price history, notifications or devices, and no market-value source for holdings | Build work plus D9 (market data) |
| API hosting | No host exists for the NestJS API (Vercel is not a fit for Socket.IO and workers) | Infrastructure decision |
| Admin network allow-list | `ADMIN_ALLOWED_IPS` must be set; production returns NOT_AVAILABLE for admin routes until it is | Ops |
| Staff MFA enrolment | Staff members must have confirmed TOTP before a role takes effect | Ops |
| Vercel production target | The test web build still carries the production target. SSO protection now covers every deployment, so only team members can open it. The target itself cannot be changed with the available tools | Ops: redeploy as preview and remove the production domain in Vercel settings |

## Deployment checklist (once blockers are cleared)
1. Set every variable in `.env.example`. Secrets come from the secrets manager, never from the repo.
2. Keep `FEATURE_LIVE_PAYMENTS`, `FEATURE_LIVE_TRANSFERS`, `FEATURE_LIVE_TRADING` and `FEATURE_LIVE_KYC_PROVIDER` off
   until each provider has a `ProviderApproval` row (created through the admin maker-checker flow).
3. Run `prisma migrate deploy` against the production database, and confirm the audit and ledger triggers exist.
4. Confirm `ADMIN_ALLOWED_IPS` covers only the internal network, and that the admin routes are not reachable from
   the public customer host.
5. Run the full API suite and the typechecks against the release commit.
6. Verify the S3 document bucket: private, SSE-KMS, no public ACLs. The S3 adapter is unverified until this is done.

## Not done in this phase
- No deployment to production was made. No live provider, broker, KMS or vendor is connected.
- No load, penetration or third-party security test has been run. The automated checks above are not a substitute.
