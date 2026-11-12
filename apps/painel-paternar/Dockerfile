# Contexto de build: a RAIZ do monorepo.
#
# O painel da equipe e' um app proprio (servico `painel`), mas o servidor e' o
# MESMO da web dos pais: arquivos estaticos, `/health`, HTTPS e o repasse de
# `/v1` para a API pela rede privada. Reaproveitar o servidor ja testado evita
# um segundo jeito de fazer a mesma coisa.
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/api-pai-presente/package.json apps/api-pai-presente/
COPY apps/frontend-pai-presente/package.json apps/frontend-pai-presente/
COPY apps/painel-paternar/package.json apps/painel-paternar/
RUN bun install --frozen-lockfile

COPY apps/painel-paternar apps/painel-paternar

ENV NODE_ENV=production
WORKDIR /repo/apps/painel-paternar
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/painel-paternar/dist ./dist
COPY apps/frontend-pai-presente/server ./server

USER bun
EXPOSE 8080
CMD ["bun", "server/main.js"]
