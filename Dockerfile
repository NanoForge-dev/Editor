FROM node:25-slim AS base

ENV PNPM_HOME="/pnpm"
ENV CI="true"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm

COPY pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY pnpm-lock.yaml /app/pnpm-lock.yaml
COPY package.json /app/package.json

WORKDIR /app

FROM base AS prod

RUN pnpm install --frozen-lockfile
COPY . /app
RUN pnpm run build

FROM oven/bun:1.3 AS final

WORKDIR /app
COPY --from=prod /app/dist /app/dist

CMD [ "bun", "run", "./dist/index.js" ]
