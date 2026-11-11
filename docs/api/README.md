# HK FinHub customer API

Base path: `/v1`. JSON only. Machine-readable spec: [`openapi.json`](openapi.json) (also served at `GET /v1/openapi.json` when `OPENAPI_ENABLED=true`).

## Conventions

- **Errors** are `{ "error": { "code": "...", "message": "..." } }`. Codes are stable and safe to show users. `message` never reveals whether an account exists.
- **Auth** uses `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes. Refresh tokens rotate on every use.
- **Validation** is strict. Unknown fields are rejected with `VALIDATION_FAILED`.
- **Rate limits** return `429 RATE_LIMITED` with a `Retry-After` header.
- **Request ids**: send `X-Request-Id` (8 to 64 safe characters) or one is generated. It is echoed back on every response.
- **Money**, when it arrives in phase 5, is always `{ amountMinor: "<integer string>", currency }`.

## Sign-in flow

1. `POST /v1/auth/register` (202). Codes go to the email and mobile.
2. `POST /v1/auth/otp/verify` twice, once per channel. The account becomes `ACTIVE` after both.
3. `POST /v1/auth/login`. Returns tokens, or `status: "mfa_required"` with an `mfaToken` when 2FA is on.
4. `POST /v1/auth/login/mfa` with a `code` or a `recoveryCode`.
5. `POST /v1/auth/refresh` before the access token expires. Store the new refresh token each time.

## Realtime

Socket.IO at path `/v1/realtime`. Connect with `auth: { token: <accessToken> }`. Events arrive as `event` with `{ type: "notification", data: { title, category } }`. Only the signed-in user's events are delivered.

## Status

Sandbox. Email and SMS are not connected to a provider yet (decision D12), so codes are queued and delivery fails closed until one is approved.
