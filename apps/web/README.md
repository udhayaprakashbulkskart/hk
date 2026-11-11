# apps/web: customer web app

Next.js (App Router) customer app: landing page, authentication screens, and the authenticated area (dashboard, accounts, send, receive, global transfer, exchange, investments, portfolio, history, statements, notifications, security, profile, settings).

**Status: Phase 2 (UI).** All data comes from `src/lib/api`, which currently returns clearly labelled sample data. No live money movement, live rates, live prices or live sign-in are wired in yet. Phase 4 replaces the data client with the real API.

## Commands

```bash
pnpm --filter @hkfinhub/web dev        # http://localhost:3000
pnpm --filter @hkfinhub/web typecheck
pnpm --filter @hkfinhub/web build
pnpm --filter @hkfinhub/web start
```

## Structure

- `src/app/(auth)`: login, register, OTP verification, password reset.
- `src/app/(app)`: authenticated screens. `layout.tsx` loads notification counts and renders the shell.
- `src/components`: app shell (desktop sidebar and mobile bottom navigation), charts (Recharts, theme-aware), send-money wizard, receive panel, FX and global-transfer tools, order ticket, payment entry shell, skyline artwork.
- `src/lib/api`: the single data boundary. `test.ts` is the sample implementation.
- `src/lib/nav.ts`: navigation config shared by the sidebar and the "More" page.
- `src/lib/money.ts`: minor-unit formatting and parsing. Money is never handled as floats.

## Rules this app follows

- Balances change only after provider confirmation. Transfers return `pending`.
- Cash totals exclude investment valuations.
- Trading, deposits and withdrawals are disabled until partner approval.
- Passing functions from Server to Client Components is not allowed. Use serialisable props.
