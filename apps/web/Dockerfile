# Production image for the realgo Next.js app (apps/web).
#
# Multi-stage build that emits Next's `standalone` output, so the final image
# ships only the server bundle + traced node_modules (no full dev deps). The
# app talks to the Go API over same-origin `/api/*` — Caddy routes that path to
# the api container — so NEXT_PUBLIC_API_BASE_URL is baked empty (relative URLs)
# by default and needs no per-environment change.

# ---- deps: install node_modules from the lockfile ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone server bundle ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time. Empty = relative same-origin
# API calls (https://realgo.dev/api/v1/...), which is what the tunnel setup uses.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN useradd --create-home --shell /usr/sbin/nologin nextjs
# Standalone output: server.js + traced deps at the root, plus the static assets
# and public/ which Next does NOT bundle and must be copied alongside.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
