# @hkfinhub/payments

Payment orchestration: routes each collection or payout to an enabled provider, creates the provider request, and applies verified provider outcomes to the ledger.

## Rules

- **Routing reads a table, never code.** `ProviderCapability` rows (provider, environment, direction, country, currency, method, enabled) decide the route. If no enabled row matches, the request is refused with `ROUTE_NOT_ENABLED`.
- **Live is gated twice.** First, `FEATURE_LIVE_PAYMENTS` must be on, otherwise live requests stop before routing with `NOT_AVAILABLE`. Second, a `ProviderApproval` row must exist for that provider and environment. Live routes ship disabled.
- **Webhooks are verified, deduplicated, confirmed, then applied.** The signature is checked against the raw body. The event is recorded once per provider and event id. The provider is then asked for the payment's status, and the status decides what happens, not the event's wording.
- **Every step is idempotent.** Status changes are compare-and-set. Ledger postings use keys derived from the payment, so a replayed or redelivered webhook never credits twice. An interrupted run recovers when the event is redelivered.
- **Out-of-order events are safe.** The provider's status is the truth. An event that arrives before its state is ignored, and the later confirmed event applies once.
- **Refunds reverse the original posting** rather than editing it.
- **Reconciliation against provider statements is planned, not built.** It belongs with the scheduled worker and needs the provider statement formats confirmed in sandbox.

## Status

| Direction | Flow |
|---|---|
| Collection | CREATED, PENDING, then SUCCEEDED (posts the deposit) or FAILED. SUCCEEDED can become REFUNDED (reverses the deposit). |
| Payout | CREATED, SUBMITTED, then SUCCEEDED (the transfer posts settlement) or FAILED (the reservation is released). |

Adapters live in `integrations/*` and reach the network only through the injected `HttpTransport`. Tests use a fake transport and never make a real provider call.
