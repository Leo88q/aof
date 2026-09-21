# AOF Watchtower exporter. Build context = repository root (needs aof_backend
# for node_modules, Prisma client and IDLs, and watchtower/ for the exporter).
#   docker compose -f docker-compose.prod.yml --profile indexer up -d watchtower-exporter
FROM node:22-alpine AS builder
ARG PRISMA_SCHEMA=prisma/schema.prisma
WORKDIR /app/aof_backend
RUN apk add --no-cache openssl python3 make g++
COPY aof_backend/package*.json ./
COPY aof_backend/prisma ./prisma/
RUN npm ci
COPY aof_backend/tsconfig*.json ./
COPY aof_backend/src ./src
COPY watchtower /app/watchtower
RUN npx prisma generate --schema "$PRISMA_SCHEMA" \
 && npx tsc -p ../watchtower/tsconfig.json --outDir ../watchtower/dist

FROM node:22-alpine AS runner
ARG PRISMA_SCHEMA=prisma/schema.prisma
ENV NODE_ENV=production
WORKDIR /app/aof_backend
RUN apk add --no-cache openssl
COPY aof_backend/package*.json ./
COPY aof_backend/prisma ./prisma/
RUN npm ci --omit=dev
COPY --from=builder /app/aof_backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/watchtower/dist /app/watchtower/dist
COPY watchtower/integration-manifest.json /app/watchtower/
COPY watchtower/events /app/watchtower/events
RUN ln -s /app/aof_backend/node_modules /app/watchtower/node_modules
WORKDIR /app/watchtower
USER node
EXPOSE 8790
CMD ["node", "dist/watchtower/src/watchtower-exporter.js"]
