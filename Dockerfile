FROM oven/bun:1.4.4-slim AS bun

FROM node:22.23.4-bookworm-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --backend=copyfile
COPY . .
RUN bun run build-ts
ENV NODE_ENV=production
CMD ["node", "dist/app.js"]
