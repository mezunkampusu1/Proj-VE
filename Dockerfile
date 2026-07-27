# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1) deps: bağımlılıkları kur
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
# `npm ci`, package.json'daki "postinstall" script'i ile `prisma generate`
# çalıştırır; bu nedenle şema dosyası npm ci'dan önce mevcut olmalıdır.
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------------------
# 2) builder: Prisma client'ı üret ve Next.js uygulamasını derle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# 3) runner: yalnızca çalışma zamanı için gerekli dosyaları içeren küçük imaj
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Dosyalar modülü (Faz 1) için kalıcı yükleme dizini; docker-compose'daki
# uploads_data volume'ü buraya bağlanır.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
