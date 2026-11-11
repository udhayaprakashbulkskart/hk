# Web end-to-end and layout tests

Playwright tests for `apps/web`.

- `specs/routes.spec.ts`: every screen at 360, 768 and 1440 px, in dark and light themes. Checks HTTP 200, exactly one `h1`, no horizontal page scroll, no console errors, and the sample-data notice.
- `specs/flows.spec.ts`: sandbox flows: login, OTP paste, registration validation, send money to a pending result, QR receive, FX quote, deposit and withdraw notices, disabled trade ticket, theme persistence, navigation, market filter, order tabs.

Run after building the web app:

```bash
pnpm --filter @hkfinhub/web build
pnpm --filter @hkfinhub/web-e2e test
# Save review screenshots (outside the repo):
SCREENSHOT_DIR=/path/to/out pnpm --filter @hkfinhub/web-e2e screenshots
```

Uses the pre-installed Chromium at `/opt/pw-browsers/chromium` (override with `CHROMIUM_PATH`).
