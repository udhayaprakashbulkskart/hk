# PUBG Store — PUBG Mobile & BGMI Marketplace

A mobile-first marketplace for buying and selling **officially transferable** PUBG Mobile / BGMI cosmetics and UC top-ups, with verified sellers, escrow-protected payouts, Razorpay payments and a separate admin console.

> **Not affiliated with KRAFTON, PUBG Corporation or Tencent.** "PUBG", "PUBG MOBILE" and "BATTLEGROUNDS MOBILE INDIA" are trademarks of their owners. Read [Compliance](#compliance-decisions) and the [deployment checklist](#production-deployment-checklist) before going live.

**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Node.js route handlers · PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) · database-backed sessions · Razorpay · Cloudinary · Vercel.

---

## Modules

| Area | What's built |
|---|---|
| **Storefront** | Home (banner carousel, quick actions, categories, trending, featured, deals, recently listed, popular sellers, UC promo), Marketplace and Buy Skins (search, category chips, rarity / game / price / level filters, 4 sort orders, pagination: all state lives in the URL), product detail (gallery, video, **drag-to-rotate 360° viewer** for listings with spin frames, specs, rarity/level, seller card, related items, report listing), public seller pages with reviews. |
| **Selling** | Seller onboarding (store name, legal name, PAN last 4, payout UPI, policy agreement) → admin verification. Listing form with category, game/platform, rarity, level, features, delivery method, price/compare-at price, stock, uploads of up to 5 images and 1 video, compliance acknowledgement, and drafts. Every new or edited listing goes through moderation. Listing management with status tabs, edit and archive. |
| **Cart and checkout** | Cart with quantity and stock checks, Buy Now, checkout capturing **Player ID only**, wallet or Razorpay payment, stock reserved atomically, unpaid orders auto-expire after 30 minutes. |
| **Payments and wallet** | Razorpay order creation, signature verification **and** a server-side re-fetch of the payment (status and amount), auto-capture, webhook as the source of truth (idempotent), receipts, transaction history, wallet top-ups, refunds to the original payment method or the wallet, seller earnings dashboard with a monthly chart, UPI withdrawal requests, admin-controlled commission. |
| **Fulfilment (escrow)** | Seller marks an item delivered with a note → buyer confirms → the earning (price minus commission) is credited to the seller's wallet. Delivered items auto-complete after the protection window. Buyers can request a refund before confirming, and rate the seller afterwards. |
| **User dashboard** | Profile overview, purchases, sales (with the buyer's Player ID to deliver to), listings, saved items, wallet, notifications, ratings, account settings (profile, default Player ID, password change that signs out other devices). |
| **Support** | FAQ, ticket form (pre-filled from orders), ticket history with admin replies. |
| **Admin console** (`/admin`, separate layout) | Analytics (GMV, commission, orders, users, 30-day revenue chart, sales by category, top sellers), listing approval/rejection/featuring, seller verification, orders and payment transactions (with fulfilment overrides), refunds, withdrawals (UTR recorded), reported listings (take down / resolve / dismiss), users (suspend, reactivate, promote), promotional banners, support tickets, commission and protection window settings, searchable audit log. |

Every list has loading skeletons, empty states and error boundaries. Every form has client- and server-side validation with field-level errors.

## Compliance decisions

The spec asks that the store only support transactions the games' terms allow. Here is how the code enforces that:

- **No account trading.** There is no "Accounts" category (the mockup showed one). Listings that mention selling accounts or passwords/OTPs are rejected server-side, and buyers can report them under "Account selling" or "Asks for password/OTP".
- **No credentials, ever.** Checkout and profiles accept only a numeric **Player ID**. Nothing in the schema stores game passwords, OTPs or login sessions.
- **Allow-listed delivery methods only:** official in-game gift to a Player ID, official redeem code, or UC top-up through an authorised channel. Sellers must confirm compliance on every listing.
- **UC packs** are sold only by the platform's "official store". Admins fulfil them manually through an authorised top-up partner. A partner API isn't integrated because it requires a commercial agreement.
- A **non-affiliation disclaimer** appears in the footer and terms page. The site name is configurable (`NEXT_PUBLIC_SITE_NAME`).

## Architecture

```
src/
  app/
    (store)/…          storefront pages (server components) + loading/error/not-found
    admin/…            admin console (own layout, role-gated)
    api/…              JSON route handlers — the backend API
  components/          ui/ layout/ product/ forms/ home/ admin/ — reusable components
  lib/
    auth.ts            sessions (SHA-256-hashed tokens in Postgres, httpOnly cookie), role guards
    api.ts             handler wrapper: origin check, Zod → 422 field errors, uniform JSON
    services/          catalog, products (moderation), orders (checkout, payments, escrow, refunds, withdrawals)
    wallet.ts          ledger: every balance change writes a WalletTransaction; debits can't go negative
    razorpay.ts        REST client + signature verification (server-only)
    storage.ts         Cloudinary signed direct uploads / local dev uploads (magic-byte validated)
    validation.ts      Zod schemas shared by forms and API
  proxy.ts             fast redirect for signed-out users (real checks happen server-side)
prisma/                schema, migrations, seed
scripts/               SVG art generator, isolated integration-test runner
tests/                 unit/ (pure logic) and integration/ (HTTP + DB, mock Razorpay)
```

**Money** is stored as integer paise. **Concurrency:** stock reservation, wallet debits, payouts and refunds use conditional `updateMany` inside transactions, so they can't oversell, double-pay or go negative (covered by tests).

**Security:** bcrypt (cost 12) password hashing; database-backed sessions that are revocable and rolling; SameSite=Lax httpOnly cookies plus a cross-origin check on mutations; Postgres-backed rate limits on login, registration, checkout, uploads, reports and tickets; role checks in every admin route; audit log for sensitive actions; security headers (HSTS, `X-Frame-Options: DENY`, nosniff, referrer and permissions policy); uploads validated by file signature, not MIME type; media URLs restricted to our own storage. Payment secrets stay on the server: the browser only ever receives the public key id and a Razorpay order id.

## Local setup

Requirements: Node.js ≥ 20.9 and PostgreSQL 14+.

```bash
npm install                          # also runs `prisma generate`
cp .env.example .env                 # set DATABASE_URL at minimum
npx prisma migrate deploy            # or `npm run db:migrate` while developing the schema
npm run db:seed                      # demo data (refuses to run with NODE_ENV=production)
npm run dev                          # http://localhost:3000
```

Demo accounts (seed only; **never seed production**):

| Role | Email | Password |
|---|---|---|
| Admin | admin@pubgstore.dev | Admin@12345 |
| Buyer (₹18k wallet, order history) | demo@pubgstore.dev | Demo@12345 |
| Verified seller | ghost@pubgstore.dev (also raven@, drift@, neon@) | Seller@12345 |
| Pending seller applicant | applicant@pubgstore.dev | Seller@12345 |

Without Razorpay keys, online payment is disabled with a clear message and wallet checkout still works, so every flow can be exercised locally. The seed artwork in `public/art` is original, generated SVG (`npm run art`); real listings use seller uploads.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint (incl. React Compiler rules) / `tsc` |
| `npm test` | Unit tests: money, validation, Razorpay signatures, filters |
| `npm run test:integration` | 24 end-to-end API tests against a **separate** DB (`TEST_DATABASE_URL`, wiped each run) on port 3100, with a mock Razorpay gateway |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |

The integration suite covers auth/sessions, CSRF, RBAC, moderation and compliance filters, wallet checkout → delivery → escrow payout, commission math, rollback on insufficient funds, concurrent last-unit purchases, refunds (wallet and original method), withdrawals, Razorpay forged signatures, failed payments, amount mismatches, webhook signature checks and replays, wallet top-ups and the cron endpoint.

## Razorpay setup

1. In the Razorpay Dashboard, generate **API keys** (test mode first). Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Add a **webhook** pointing to `https://YOUR_DOMAIN/api/payments/razorpay/webhook` with events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` and `refund.failed`. Set its secret as `RAZORPAY_WEBHOOK_SECRET`.
3. Payment flow: the server creates the Razorpay order and Checkout opens in the browser. The browser posts the result to `/api/payments/razorpay/verify`, which verifies the HMAC signature **and** re-fetches the payment from Razorpay to confirm `captured` status and the exact amount. The webhook does the same independently, so orders are confirmed even if the buyer closes the tab. Late payments on expired orders are refunded to the wallet automatically.
4. Seller payouts are recorded manually: pay by UPI, then enter the UTR in **Admin → Withdrawals**. RazorpayX Payouts can automate this later.

## Media storage

`STORAGE_DRIVER` selects how seller images and videos are stored:

- **`vercel-blob`** (used in production): the browser uploads directly to Vercel Blob with a short-lived token from `/api/uploads/blob`. Tokens are issued only to signed-in users, for image/video types up to 25 MB, under `listings/`, with random suffixes. Requires `BLOB_READ_WRITE_TOKEN`, which Vercel adds automatically when a Blob store is connected to the project. Listings may only reference files on *this* project's Blob host.
- **`cloudinary`**: direct signed uploads using `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
- **`local`** (default, development only): writes to `public/uploads`. It is disabled in production because Vercel's filesystem is read-only.

## Deployment (Neon + Vercel)

The live setup:

| Piece | Where |
|---|---|
| Database | Neon project `pubg-store`, Postgres 17, AWS Singapore (`aws-ap-southeast-1`), database `pubgstore` |
| App | Vercel project `pubg-store`, functions in Singapore (`sin1`) |
| Media | Vercel Blob store `pubg-store-media` (Singapore), connected to the project |

Environment variables (Vercel → Project → Settings → Environment Variables):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (host contains `-pooler`), `sslmode=verify-full`. Used at runtime. |
| `DIRECT_URL` | Neon **direct** connection string (no `-pooler`). Used only by `prisma migrate deploy` during the build. |
| `BLOB_READ_WRITE_TOKEN` | Added automatically by the Blob store connection. |
| `STORAGE_DRIVER` | `vercel-blob` |
| `CRON_SECRET` | Long random string. Vercel Cron sends it to `/api/cron/maintenance`. |
| `NEXT_PUBLIC_SITE_NAME` | Display name. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Add when going live with payments; until then checkout shows "online payments not configured". |

Database credentials are scoped to the **Production** environment only, so preview builds can't migrate or write to the live database. For previews, create a Neon branch per preview and set preview-scoped `DATABASE_URL`/`DIRECT_URL`.

How it deploys: `vercel-build` runs `prisma generate && prisma migrate deploy && next build`, so schema migrations apply automatically on every production deploy (over `DIRECT_URL`). The schedule in `vercel.json` runs the maintenance job daily.

First admin: on a fresh database, register normally, then promote the account in the Neon SQL editor: `UPDATE "User" SET role='ADMIN' WHERE email='you@example.com';`.

## Production deployment checklist

**Legal & compliance**
- [ ] Get legal review of the brand name: "PUBG" is a registered trademark. Consider a neutral name (`NEXT_PUBLIC_SITE_NAME`) and logo.
- [ ] Confirm with counsel which item transfers PUBG Mobile / BGMI's **current** terms permit. Adjust the allowed delivery methods (`DeliveryMethod` enum and listing form) to match.
- [ ] Sign an agreement with an authorised UC distributor before selling UC packs, or disable the UC category.
- [ ] Finalise Terms, Privacy and Refund policies (Razorpay requires them on the site), plus GST/TDS handling for marketplace sellers.

**Payments**
- [ ] Complete Razorpay KYC and switch to **live** keys.
- [ ] Register the production webhook URL and secret. Send a test event and check it appears in Admin → Orders → Transactions.
- [ ] Make a real low-value test purchase end to end, then a refund.
- [ ] Set the commission % and protection window in Admin → Commission.

**Infrastructure**
- [ ] Managed Postgres with automated backups and point-in-time recovery; pooled `DATABASE_URL`.
- [ ] Run `prisma migrate deploy` successfully (part of `vercel-build`).
- [ ] Connect a Vercel Blob store (or Cloudinary), set `STORAGE_DRIVER`, and upload a test image and video.
- [ ] Set a long random `CRON_SECRET` and confirm the cron run in Vercel logs.
- [ ] Custom domain with HTTPS (HSTS preload is on, so check before submitting to the preload list).
- [ ] Error monitoring and log drain (Sentry, Vercel Observability).
- [ ] Do **not** run the seed. Create the first admin manually (step 5 above).

**Security**
- [ ] All secrets are in Vercel env vars only. Nothing uses `NEXT_PUBLIC_` except the site name.
- [ ] `RATE_LIMIT_DISABLED` and `ALLOW_LOCAL_UPLOADS` are unset.
- [ ] Admin accounts use strong unique passwords. Consider adding 2FA for admins before launch.
- [ ] Review `/admin/audit` after the first test transactions.

**Quality gates**
- [ ] `npm run lint && npm run typecheck && npm test && npm run test:integration` all pass.
- [ ] Manual pass on a real phone: browse → buy → deliver → confirm → withdraw.

## Known limitations / next steps

- Email/SMS delivery for notifications and password reset isn't wired up. Notifications are in-app only, so add a provider (Resend, MSG91) before launch.
- No admin 2FA yet.
- Withdrawals are paid out manually (no RazorpayX integration).
- There's no admin UI for wallet adjustments (they're possible through the ledger helpers).
- The 360° viewer needs a sequence of spin frames (media type `SPIN`). The seller form currently uploads images and video only, so spin sets are added through the database or a future upload flow.
