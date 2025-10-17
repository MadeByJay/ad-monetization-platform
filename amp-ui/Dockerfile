FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
WORKDIR /app

# install deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile=false

# copy sources
COPY . .
ENV PORT=3001
EXPOSE 3001
CMD ["pnpm","run","dev"]

