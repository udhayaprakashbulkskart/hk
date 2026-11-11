# @hkfinhub/fx

Currency quotes and conversions. All arithmetic is integer.

- Rates are scaled by 10^8 (`RATE_SCALE`). A rate of 0.1282 is stored as 12820000.
- The service fee is 20 basis points (0.20%), rounded up in minor units. The recipient amount is rounded down. The platform never gives away a fraction of a unit.
- A quote holds its rate for 30 seconds and can be used once.
- A conversion posts one balanced leg per currency: customer out, FX position and fee in the source currency; FX position out and customer in the target currency.
- Rates come from `FxProvider`. The test provider uses illustrative sample rates, labelled as sample in every response. The real provider is decision D3.
