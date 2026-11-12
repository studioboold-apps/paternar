# Contexto de build: a RAIZ do monorepo.
#
# O Vite ASSA a variavel no bundle: `APP_ENV` tem de existir no build, nao no
# boot (`web.md` §12). Esquecer o `--build-arg` nao quebra nada — cai em
# producao, que e o padrao seguro: a instalacao do cliente nunca pede desculpa
# por ser um ambiente de teste.
ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/api-pai-presente/package.json apps/api-pai-presente/
COPY apps/frontend-pai-presente/package.json apps/frontend-pai-presente/
COPY apps/painel-paternar/package.json apps/painel-paternar/
RUN bun install --frozen-lockfile

COPY apps/frontend-pai-presente apps/frontend-pai-presente

# Nenhum deles e segredo: os dois identificadores sao publicos por natureza e o
# navegador os le no bundle (security.md §4). Segredo nunca vira `--build-arg`,
# porque ele fica gravado na camada da imagem.
ARG APP_ENV
ARG GOOGLE_CLIENT_ID
ARG APPLE_CLIENT_ID
# Anuncio (AdSense): publicos tambem. Sem ADS_ENABLED=1, nenhum anuncio aparece.
ARG ADS_ENABLED
ARG ADSENSE_CLIENT_ID
ARG ADSENSE_SLOT_ID
ENV APP_ENV=${APP_ENV} \
    GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
    APPLE_CLIENT_ID=${APPLE_CLIENT_ID} \
    ADS_ENABLED=${ADS_ENABLED} \
    ADSENSE_CLIENT_ID=${ADSENSE_CLIENT_ID} \
    ADSENSE_SLOT_ID=${ADSENSE_SLOT_ID} \
    NODE_ENV=production

WORKDIR /repo/apps/frontend-pai-presente
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/frontend-pai-presente/dist ./dist
COPY --from=build /repo/apps/frontend-pai-presente/server ./server

USER bun
EXPOSE 8080
CMD ["bun", "server/main.js"]
