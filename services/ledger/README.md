# @hkfinhub/ledger

Double-entry ledger: the only way money moves on the platform. Framework-free. Persistence is injected through `LedgerStore` (`src/ports.ts`); the Postgres implementation is `PrismaLedgerStore` in `packages/database`.

## Rules

- **Integer minor units only** (`bigint`). Validated against the currency table in `packages/shared`.
- **Balanced:** entries must net to zero per currency, or the posting is refused before any write. The database checks this again at commit.
- **Idempotent:** the same key with the same body returns the original transaction (`replayed: true`). The same key with a different body is refused with `IDEMPOTENCY_CONFLICT`.
- **Immutable:** entries and transactions cannot be updated or deleted (database triggers). A correction is a reversal, which posts the mirror image and never edits the original. One reversal per transaction, enforced by a unique key.
- **No overdraft:** customer accounts cannot go below zero. The database refuses it, even under concurrency (see `apps/api/test/ledger-db.test.ts`).
- **Write guard:** balances change only inside the posting function, which sets a transaction-local flag. A direct `UPDATE` is refused by the database.
- **Ordered locking:** balances are updated in account-id order, so opposite-direction transfers cannot deadlock.

## Money movements

| Method | Entries | Balance effect |
|---|---|---|
| `recordVerifiedDeposit` | settlement → customer available | available up |
| `holdFunds` | customer available → customer hold | available down, pending up |
| `settleHold` | customer hold → settlement | pending down; leaves the customer |
| `releaseHold` | customer hold → customer available | pending down, available up |
| `reverse` | mirror of an earlier transaction | restores that transaction's balances |

`recordVerifiedDeposit` has no public endpoint. Phase 6 calls it only after a verified provider webhook.

## Maker-checker

`AdjustmentWorkflow` records a request, which changes no balance. A different person must approve it before anything is posted. Self-approval is refused. Admin roles arrive in phase 9.

## Reconciliation

`reconcile()` compares each stored balance with the balance implied by its entries. Any mismatch is written as an open `ReconciliationRecord`. It never corrects a balance silently.

## Tests

- `test/property.test.ts`: fast-check properties over random sequences of postings, reversals and replays, using an in-memory store that enforces the same rules. Checks double entry, no negative customer balances, refused postings leaving no trace, exact reversal, and replay safety.
