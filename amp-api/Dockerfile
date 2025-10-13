# ---------- deps ----------
FROM node:20-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
WORKDIR /app

# Copy manifests needed to resolve deps
COPY package.json pnpm-lock.yaml* nest-cli.json tsconfig.json tsconfig.build.json* ./
RUN pnpm install --frozen-lockfile=false

# ---------- build ----------
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# build with Nest CLI
RUN pnpm run build

# ---------- runtime ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Runtime deps only
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile=false
# Bring compiled code
COPY --from=builder /app/dist ./dist
# expose + start
ENV API_PORT=3001
EXPOSE 3001
CMD ["node","dist/src/main.js"]

