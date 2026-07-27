# syntax=docker/dockerfile:1
#
# Ortak Alan modülünün gerçek zamanlı işbirliği servisi (Yjs + Hocuspocus).
# Ana Next.js uygulamasından bağımsız, hafif bir Node süreci; Prisma client
# üretimine ihtiyaç duymaz — Postgres'e doğrudan `pg` ile bağlanır (bkz.
# src/db.ts). Derleme adımı yok; üretimde de `tsx` ile TS doğrudan çalıştırılır.
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 collab

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
USER collab

EXPOSE 1234
CMD ["npx", "tsx", "src/index.ts"]
