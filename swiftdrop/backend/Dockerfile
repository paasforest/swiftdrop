# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Non-root user for least-privilege execution
RUN addgroup -S swiftdrop && adduser -S swiftdrop -G swiftdrop

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Never copy .env — all secrets are injected by Railway at runtime
# as environment variables. No ARG/ENV secrets here.

RUN chown -R swiftdrop:swiftdrop /app
USER swiftdrop

EXPOSE 4000
CMD ["node", "server.js"]
