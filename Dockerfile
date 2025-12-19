# Base stage for dependencies
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk update && apk upgrade --no-cache && apk add --no-cache dumb-init tzdata
ENV TZ=America/Bogota
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Crear usuario para no correr como root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Instalar solo dependencias de producción
RUN pnpm install --prod --frozen-lockfile

USER nestjs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "dist/main"]