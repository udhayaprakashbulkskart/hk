# Deploying the API (Render, Neon, Redis)

Status: **prepared, not deployed.** The container image has not been built in this environment (no Docker daemon
available here). The first build on Render is the test.

## Pieces
- **Database:** Neon project `hk-finhub`. For migrations, use the direct (non-pooled) connection string as `DATABASE_URL`.
- **Redis:** a hosted Redis instance, for example Upstash. Required for login rate limits and live updates.
- **API:** Render web service built from `infrastructure/docker/api.Dockerfile` (blueprint: `render.yaml`).
- **Web:** the Vercel project `hk-finhub-web`. Set `NEXT_PUBLIC_API_URL` to the Render URL and redeploy.

## Steps
1. Create the Render blueprint from `render.yaml`. Enter every `sync: false` value in the dashboard. Never commit them.
2. Set `CORS_ORIGINS` to the Vercel web origin(s). Use `https://` and no trailing slash.
3. Set `LOGIN_USER_EMAIL`, `LOGIN_USER_PHONE` and `LOGIN_USER_PASSWORD` (all three together), then deploy.
4. Check `GET /v1/health` returns OK, then `GET /v1/ready` (database and Redis reachable).
5. On Vercel, set `NEXT_PUBLIC_API_URL` to the Render URL and redeploy the preview.
6. Sign in with the operator email and password from the customer web app.

## Still needed before step 1
- A Render account (or Fly.io, if preferred) with permission to create services.
- A Redis URL (Upstash or similar).
- The operator's email address and phone number.
- A new operator password. The one shared in chat should not be used on a public site.
