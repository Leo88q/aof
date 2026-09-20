FROM node:22-alpine AS builder
# PRISMA_SCHEMA selects the datasource provider at image build time:
#   prisma/schema.prisma            (default, SQLite baseline)
#   prisma/postgres/schema.prisma   (PostgreSQL, see docs/POSTGRES_MIGRATION.md)
ARG PRISMA_SCHEMA=prisma/schema.prisma
ENV PRISMA_SCHEMA=${PRISMA_SCHEMA}
WORKDIR /app
RUN apk add --no-cache openssl python3 make g++
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
COPY services ./services
COPY scripts ./scripts
# No fallback build: a failed generate/typecheck must stop the image release.
RUN npx prisma generate --schema "$PRISMA_SCHEMA" && npx tsc -p . && npx tsc -p tsconfig.workers.json

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && mkdir /app/data && chown node:node /app/data
ARG PRISMA_SCHEMA=prisma/schema.prisma
ENV NODE_ENV=production PRISMA_SCHEMA=${PRISMA_SCHEMA}
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-workers ./dist-workers
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
