FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY services ./services
COPY scripts ./scripts

RUN npx prisma generate
RUN npm run build || npx tsc -p .

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/idl ./dist/src/idl
COPY --from=builder /app/src/idl ./src/idl

EXPOSE 8080

CMD ["node", "dist/server.js"]
