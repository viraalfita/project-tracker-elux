FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
# Runtime env vars (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, SMTP_*, etc.)
# .env.local is not included in the builder's COPY; pass secrets via
# docker run --env-file .env.local  OR  set them in your compose / host.

EXPOSE 3000

CMD ["npm","run","start","--","-p","3000"]
