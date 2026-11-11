# @hkfinhub/wallet

Read-only projections over the ledger: balances per currency (available, pending, total), totals (deposits, withdrawals, transfers) and recent activity.

- Activity covers the customer's spendable accounts only, so each transaction appears once. Internal moves to HOLD are not listed.
- Pending status for a transfer is taken from the hold. Phase 6 adds a transfer state machine, so a transfer's status will follow its confirmation or failure.
- Owns no state.
