FROM node:22-alpine AS builder
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
RUN npm run build && npx tsc -p tsconfig.workers.json

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && mkdir /app/data && chown node:node /app/data
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-workers ./dist-workers
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
