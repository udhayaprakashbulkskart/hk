# @hkfinhub/investment

Investment orders and holdings. Test only until a licensed broker is contracted (D8 to D10).

- **Risk checks first**: KYC must be verified. A buy needs a limit price, and its cost must fit within available cash
  minus cash held by other open buys. A sell is limited to shares held, minus shares already on open sells.
- **Holdings come only from broker-confirmed fills.** Each broker fill id is unique, so a repeated sync cannot double a position.
- **Settlement** posts to the ledger once per fully filled order, keyed by order id.
- **P&L** uses average cost, computed in integer minor units (`src/position.ts`).
- **No broker, no orders**: in production no broker is configured, so placing an order returns NOT_AVAILABLE.
- The test broker (`src/test-broker.ts`) changes state only when a test drives it. It is not a market.

Not built: real broker adapters, market data, valuation, daily snapshots.
