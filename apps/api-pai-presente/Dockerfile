# Contexto de build: a RAIZ do monorepo.
#
# Multi-estagio porque a imagem final nao pode carregar fonte nem dependencia:
# `bun build` fecha tudo num arquivo so, e o que sobe tem o binario do Bun, o
# bundle e as migrations. Sem `node_modules`, sem `.ts`, sem `bun.lock`.
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /repo

# Os manifestos primeiro: mexer em codigo nao invalida a camada de instalacao.
COPY package.json bun.lock ./
COPY apps/api-pai-presente/package.json apps/api-pai-presente/
COPY apps/frontend-pai-presente/package.json apps/frontend-pai-presente/
COPY apps/painel-paternar/package.json apps/painel-paternar/
# `--frozen-lockfile` (security.md §4): build reprodutivel, versao igual a testada.
RUN bun install --frozen-lockfile

COPY apps/api-pai-presente apps/api-pai-presente
WORKDIR /repo/apps/api-pai-presente
RUN bun build ./src/main.ts ./src/database/migrate.ts ./src/backup/run-backup.ts ./src/backup/run-restore.ts --target=bun --outdir=dist
# O bundle perde o `__dirname` dos pacotes do SDK, e com ele a pasta de
# migrations de cada um. `cp -L` porque o `node_modules` do Bun e' feito de
# links: copiar o link levaria para a imagem um caminho que nao existe nela.
RUN mkdir -p sdk-migrations \
 && for module in user-module customer-module recommendation-module notification-module; do \
      cp -rL "node_modules/@adatechnology/$module/dist/migrations" "sdk-migrations/$module"; \
    done

# O `backup` vem ANTES do `runtime` porque `docker build` sem `--target`
# constroi o ULTIMO estagio, e e assim que o Railway constroi. Com o backup
# no fim, o que subiu foi a imagem do backup: ela nao carrega `drizzle`, e o
# pre-deploy morreu falando de migration, nunca de estagio.
# O backup roda em imagem SEPARADA, e nao na da API.
#
# `pg_dump` nao existe na imagem oficial do Bun: o alvo de backup precisa do
# cliente do Postgres, e enfiar `postgresql-client` na imagem que atende HTTP
# engordaria a superficie de toda requisicao por causa de um trabalho que roda
# uma vez por dia.
#
# A versao do cliente acompanha a do servidor: `pg_dump` mais VELHO que o banco
# recusa o dump, e essa recusa so aparece na primeira execucao agendada.
FROM oven/bun:${BUN_VERSION}-alpine AS backup
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache postgresql17-client
COPY --from=build /repo/apps/api-pai-presente/dist ./dist
USER bun
# `dist/backup/`, nao `dist/`: com varias entradas o `bun build` guarda o caminho
# relativo a raiz comum. Escrito como `dist/run-backup.js` a imagem constroi,
# sobe e so falha na primeira execucao agendada, com "modulo nao encontrado".
CMD ["bun", "dist/backup/run-backup.js"]

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# O migrador le `./drizzle` a partir do diretorio de trabalho.
COPY --from=build /repo/apps/api-pai-presente/dist ./dist
COPY --from=build /repo/apps/api-pai-presente/drizzle ./drizzle
# `src/database/sdk-migrations.ts` le daqui: usuarios da equipe, anunciantes e recomendacoes.
COPY --from=build /repo/apps/api-pai-presente/sdk-migrations ./sdk-migrations

# O volume do Railway e montado com dono root, e `bun` (uid 1000) nao escreve
# nele. Medido em producao: `503 MEDIA_DIRECTORY_NOT_WRITABLE` em /data/media,
# com `drwxr-xr-x root root /data`. So root muda dono, entao o entrypoint sobe
# como root, ajusta a pasta e cai para `bun` com `su-exec` — a API nunca atende
# requisicao como root, e `USER bun` aqui impediria o ajuste.
RUN apk add --no-cache su-exec
COPY apps/api-pai-presente/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
EXPOSE 3000
CMD ["bun", "dist/main.js"]
