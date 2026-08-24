# Base stage
FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS base
ARG PNPM_VERSION=11.23.0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && \
  for attempt in 1 2 3 4 5; do \
  corepack install --global "pnpm@${PNPM_VERSION}" && break; \
  if [ "$attempt" -eq 5 ]; then exit 1; fi; \
  sleep "$((attempt * 2))"; \
  done && \
  apk update && apk upgrade --no-cache && \
  apk add --no-cache dumb-init tzdata libc6-compat
ENV TZ=America/Bogota
WORKDIR /app

# Dependencies stage (Development & Build)
FROM base AS deps
ENV CI=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
ENV CI=true
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ARG SENTRY_RELEASE=""
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN --mount=type=secret,id=sentry_auth_token,required=false \
  if [ -s /run/secrets/sentry_auth_token ]; then \
  if [ -z "$SENTRY_ORG" ] || [ -z "$SENTRY_PROJECT" ] || [ -z "$SENTRY_RELEASE" ]; then \
  echo "SENTRY_ORG, SENTRY_PROJECT y SENTRY_RELEASE son obligatorios para subir source maps." >&2; \
  exit 1; \
  fi; \
  export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; \
  pnpm exec sentry-cli sourcemaps inject \
  --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --release "$SENTRY_RELEASE" dist; \
  pnpm exec sentry-cli sourcemaps upload \
  --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --release "$SENTRY_RELEASE" \
  --validate --wait dist; \
  fi && \
  find dist -type f -name '*.js.map' -delete

# Production dependencies stage
FROM base AS prod-deps
ENV CI=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Production runner
FROM base AS runner
ENV NODE_ENV=production
ARG SENTRY_RELEASE=""
ENV SENTRY_RELEASE="$SENTRY_RELEASE"

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nestjs && \
  rm -rf /usr/local/lib/node_modules/npm \
  /usr/local/lib/node_modules/corepack \
  /opt/yarn-* \
  /pnpm && \
  rm -f /usr/local/bin/npm \
  /usr/local/bin/npx \
  /usr/local/bin/yarn \
  /usr/local/bin/yarnpkg \
  /usr/local/bin/corepack \
  /usr/local/bin/pnpm \
  /usr/local/bin/pnpx

COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package.json ./

USER nestjs
EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main"]
