FROM node:26-slim AS base

ENV PNPM_HOME="/pnpm"
ENV CI="true"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm bun

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

COPY . /app
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@nanoforge-dev/editor...

FROM oven/bun:1.3 AS final

ARG FS_ROOT
ARG ARCHIVE_ROOT

WORKDIR /app
COPY --from=prod /app/apps/editor/dist /app/dist

RUN mkdir -p /app/${FS_ROOT} /app/${ARCHIVE_ROOT}

# Runtime dependencies kept out of the server bundle (dist/package.json)
RUN cd /app/dist && bun install --production --ignore-scripts

RUN apt update && apt install git -y

RUN bun install -g @nanoforge-dev/cli

ENV HOST=0.0.0.0
CMD [ "bun", "run", "./dist/index.js" ]
