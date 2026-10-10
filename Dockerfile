FROM node:26-slim AS base

ENV PNPM_HOME="/pnpm"
ENV CI="true"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@12.0.0 bun@1.3.14

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

FROM oven/bun:1.3.14 AS final

ARG FS_ROOT
ARG ARCHIVE_ROOT
ARG PUBLIC_MODE
ARG PUBLIC_PM_URL

# The server reads its mode at runtime (packages/server-core/src/env/load-env.ts)
ENV PUBLIC_MODE=${PUBLIC_MODE}
ENV PUBLIC_PM_URL=${PUBLIC_PM_URL}
ENV FS_ROOT=${FS_ROOT}

WORKDIR /app
COPY --from=prod /app/apps/editor/dist /app/dist

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Runtime dependencies kept out of the server bundle (dist/package.json)
RUN cd /app/dist && bun install --production --ignore-scripts

# Global tools go where the unprivileged user can run them
ENV BUN_INSTALL_GLOBAL_DIR=/usr/local/share/bun-global
ENV BUN_INSTALL_BIN=/usr/local/bin
RUN bun install -g @nanoforge-dev/cli@2.3.1

RUN mkdir -p /app/${FS_ROOT} /app/${ARCHIVE_ROOT} && chown -R bun:bun /app/${FS_ROOT} /app/${ARCHIVE_ROOT}

USER bun

ENV HOST=0.0.0.0
CMD [ "bun", "run", "./dist/index.js" ]
