# @hkfinhub/shared

Framework-agnostic money and currency helpers. Single source of truth for launch currencies and their minor-unit exponents, used by the ledger, the database seed and the clients.

Money is always integer minor units (`bigint` in the backend). `parseMinor` and `minorToDecimal` are the only conversions between decimal text and minor units.
