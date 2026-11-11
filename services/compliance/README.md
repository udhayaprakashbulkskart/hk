# @hkfinhub/compliance

Sanctions screening, compliance cases, transaction monitoring and limits. Enforced before any outbound money reserves funds.

## Guard order (`ComplianceService.assertOutbound`)
1. **KYC.** No verified tier, so `KYC_REQUIRED`.
2. **Holds.** An open blocking case on the user, the account or the recipient, so `COMPLIANCE_HOLD`. The message never says why, to avoid tipping off the customer.
3. **Monitoring.** Velocity and structuring alerts are opened as non-blocking cases for review. They do not stop the transfer.
4. **Limits.** Every applicable rule is checked: the corridor rule and the `*` default. The stricter one wins. A breach returns `LIMIT_EXCEEDED` with the limit, the amount already used and the requested amount.

`TransferService` calls the guard inside the account-locked transaction, after the lock and before funds are reserved. That makes the daily and monthly sums race-free.

## Screening
- A hit on onboarding (`submit`) or on a beneficiary opens a **blocking** `SANCTIONS` case. Payouts are held until a compliance admin clears it with a written note.
- Only list names and scores are stored. The screened name is not kept in the screening record.
- **Fail closed.** If screening is unavailable, a beneficiary is removed again rather than left unscreened. In production the screener is `createUnconfiguredScreener()` until a vendor is approved (D2).

## Limits and changes
Limits live in `LimitRule`, seeded by the migration (STANDARD tier, HKD). A change needs a request by one compliance admin and an approval by a different one. The approver's ID must differ from the requester's (`FORBIDDEN` otherwise).

## Policy values
The velocity and structuring thresholds in `src/container-kyc.ts` are starting values for compliance to confirm. They are not legal advice.

## Not built
Staff endpoints for clearing cases and deciding limit changes (Phase 9). The sandbox screener flags only the fixed test name. Real screening needs the vendor (D2).
