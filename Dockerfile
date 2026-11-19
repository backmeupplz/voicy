FROM oven/bun:1.4.5-slim@sha256:b780593f3e10918cbdaec3d5a08d52224b9198069a65eb47812085c2ec007643 AS bun

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked bun install --frozen-lockfile --backend=copyfile
COPY tsconfig.json ./
COPY src src
RUN bun run build-ts

# Only the runtime dependencies and the compiled code: a smaller image exports and starts faster
FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=bind,from=bun,source=/usr/local/bin/bun,target=/usr/local/bin/bun \
  --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
  bun install --frozen-lockfile --production --backend=copyfile
COPY locales locales
COPY --from=build /app/dist dist
ENV NODE_ENV=production
CMD ["node", "dist/app.js"]
