# @hkfinhub/transfers

Customer transfers, withdrawals and payment requests.

## Money rules

- **Pending moves no money.** Starting an outbound transfer records a reservation. Balances do not change. The reservation counts against what the customer can spend elsewhere.
- **Settlement posts once, on confirmation.** When the payout succeeds, the transfer posts the ledger entries keyed to the transfer, so a repeat cannot double-debit.
- **Failure releases the reservation.** Nothing was posted, so nothing needs reversing.
- **Spending is serialised.** Every spending path takes a per-account lock, then checks available minus reserved.
- **Internal transfers** between HK FinHub accounts post immediately, on the ledger, in one currency.
- **Payment requests** are shareable references. A payer sees only the amount, memo and status. A confirmed payment to the request credits the requester and closes the request.

## Routes

Outbound payouts need an enabled payout route for the recipient's country, currency and method. A SWIFT payout has no sandbox route yet, so it is refused with `NOT_AVAILABLE` and nothing is sent to a provider.
