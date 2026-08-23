# Base stage
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base
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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Production runner
FROM base AS runner
ENV NODE_ENV=production

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
