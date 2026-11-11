# HK FinHub API container. Built from the repository root.
# Debian (not Alpine): the argon2 password library ships glibc binaries.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Dependency manifests first, so the install layer is cached across source changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/ packages/
COPY services/ services/
COPY integrations/ integrations/
COPY database/ database/
COPY tests/ tests/
RUN pnpm install --frozen-lockfile --filter @hkfinhub/api...

# Generated Prisma client is git-ignored, so generate it inside the image.
RUN pnpm --filter @hkfinhub/database exec prisma generate

WORKDIR /app/apps/api
EXPOSE 4000

# Apply committed migrations, then start. The API listens on $API_PORT (set by the host).
CMD ["sh", "-c", "pnpm --filter @hkfinhub/database exec prisma migrate deploy && pnpm --filter @hkfinhub/api start"]
