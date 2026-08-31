FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.4.1 --quiet
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm migrate:verify && pnpm check && pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache wget && npm install -g pnpm@10.4.1 --quiet
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p /var/data/ideal-prime/uploads /var/data/ideal-prime/private && chown -R node:node /var/data/ideal-prime /app
USER node
EXPOSE 4000
ENV NODE_ENV=production PORT=4000 DATA_DIR=/var/data/ideal-prime UPLOAD_DIR=/var/data/ideal-prime/uploads
VOLUME ["/var/data/ideal-prime"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD wget -qO- http://127.0.0.1:4000/healthz >/dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
