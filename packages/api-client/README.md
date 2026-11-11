# @hkfinhub/api-client

The data boundary shared by the web and mobile apps.

- `src/index.ts`: exports `api`, the single client the UI uses. Currently the test implementation.
- `src/test.ts`: labelled sample data. Figures are not customer balances, live rates or market prices. Transfers always return `pending`.
- `src/money.ts`: minor-unit formatting and parsing. Money is never handled as floats.

Phase 4 adds an HTTP client implementing the same `FinHubApi` interface from `@hkfinhub/types`. Screens do not change.
