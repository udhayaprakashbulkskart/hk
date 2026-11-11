# @hkfinhub/types: API contract

Shared TypeScript types and the `FinHubApi` interface, the only data boundary used by customer clients.

- Money is `{ amountMinor: string, currency }`, an integer string of minor units. Floats are never used for money on the wire.
- `CURRENCIES` lists the launch currencies: HKD, USD, INR, EUR, GBP, AED, SGD, CNY.
- Transfers return `pending` until a verified provider confirmation exists.
