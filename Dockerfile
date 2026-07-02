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

ARG PUBLIC_MODE
ARG PUBLIC_PM_URL
ARG PUBLIC_DOCS_URL
ARG PUBLIC_LANDING_URL

ENV PUBLIC_MODE=${PUBLIC_MODE}
ENV PUBLIC_PM_URL=${PUBLIC_PM_URL}
ENV PUBLIC_DOCS_URL=${PUBLIC_DOCS_URL}
ENV PUBLIC_LANDING_URL=${PUBLIC_LANDING_URL}

RUN pnpm install --frozen-lockfile
COPY . /app
RUN pnpm run build

FROM oven/bun:1.3 AS final

ARG FS_ROOT
ARG ARCHIVE_ROOT

WORKDIR /app
COPY --from=prod /app/dist /app/dist

RUN mkdir /app/${FS_ROOT} /app/${ARCHIVE_ROOT}

RUN apt update
RUN apt install git -y

RUN bun install -g @nanoforge-dev/cli

CMD [ "bun", "run", "./dist/index.js" ]
