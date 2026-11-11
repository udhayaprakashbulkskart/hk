# @hkfinhub/database

Prisma 7 schema, migrations and the Postgres adapters for the authentication and notification ports.

- `prisma/schema.prisma`: identity, sessions, refresh tokens, OTP challenges, TOTP factors (with replay protection), recovery codes, MFA challenges, the transactional outbox, in-app notifications and the audit log.
- `prisma/migrations/`: applied in order. `*_audit_log_append_only` adds a trigger that rejects `UPDATE` and `DELETE` on `AuditLog`.
- `src/auth-store.ts`: implements `AuthStore`. Every write runs in the caller's transaction.
- Phase 5 models: `Currency`, `Account`, `CurrencyAccount`, `Beneficiary`, `LedgerAccount`, `LedgerBalance`, `LedgerTransaction`, `LedgerEntry`, `ReconciliationRecord`, `ApprovalRequest`. The `*_ledger_and_accounts` migration adds the integrity rules as triggers and a deferred balance check.
- `src/ledger-store.ts`: implements the ledger store. Balance updates are `UPDATE` then `INSERT` under the write flag, so the floor check sees the true resulting balance.
- `src/accounts-store.ts`: customer accounts, currency accounts and beneficiaries.
- `src/outbox-store.ts`: implements the notification outbox. Claims rows with `FOR UPDATE SKIP LOCKED`.

Commands:

```bash
pnpm --filter @hkfinhub/database exec prisma generate      # writes src/generated (git-ignored)
pnpm --filter @hkfinhub/database exec prisma migrate deploy
pnpm --filter @hkfinhub/database exec prisma migrate dev   # local schema changes only
```

Secrets are never stored in plain text: passwords are Argon2id hashes, OTPs and tokens are keyed HMAC digests, TOTP secrets are AES-256-GCM envelopes.
