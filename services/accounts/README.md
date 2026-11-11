# @hkfinhub/accounts

Customer accounts: one account per customer (`accountRef`), one currency account per currency, and saved recipients.

- Each currency account maps onto two ledger accounts: AVAILABLE (spendable) and HOLD (reserved for transfers in progress).
- The first request creates the account and its HKD currency account. Other currencies open on request.
- Recipient destinations (UPI IDs, account numbers) are stored with AES-256-GCM encryption. Clients only ever receive a masked form, for example `••••••••5521`.
- Money is never moved here. This package creates accounts and records recipients only.
