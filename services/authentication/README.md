# @hkfinhub/authentication

Authentication domain: registration, verification codes, password login, two-factor (TOTP and recovery codes), sessions, refresh-token rotation with reuse detection, devices and password reset.

Framework-free and database-free. Everything it needs comes through the `AuthStore`, `RateLimiter` and `AuthClock` ports (`src/ports.ts`).

## Policy (src/policy.ts)

| Control | Value |
|---|---|
| Password | 12 to 128 characters, Argon2id (19 MiB, 2 passes), common-password and email-name checks |
| Verification code | 6 digits, 5 minutes, 5 attempts, 5 sends per destination per hour |
| Lockout | 5 failed passwords locks for 15 minutes; notifies the owner |
| Login throttle | 30 per IP and 10 per account per 15 minutes |
| 2FA | TOTP, one step either side, replay blocked; 10 single-use recovery codes |
| MFA challenge | 5 minutes, 5 attempts |
| Access token | 15 minutes, HS256, checked against the session on every request |
| Refresh token | 30 days, rotated on every use; reuse ends the whole session |
| Password reset | Same response for every email; resets end all sessions |

## Guarantees the tests check

- Unknown email and wrong password produce identical responses, and the code spends similar time on both (dummy hash).
- Registering an existing email answers like a new registration and informs the owner.
- A rejected new password does not spend a reset code.
- A stored code, token or recovery code is a keyed digest; the one-time code never reaches the outbox table in plain text.

## Known gaps

- The common-password list is short. A full breached-password (k-anonymity) check is planned with the compliance providers (Phase 7).
- TOTP secrets are encrypted with a local key. KMS envelope encryption replaces this before production (architecture section 4).
