/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { join, normalize, resolve, sep } from 'node:path';

import { buildAdsTxt } from './advertising.js';
import { buildHttpsRedirect } from './https-redirect.js';
import { buildSecurityHeaders, decorateWithSecurityHeaders } from './security-headers.js';

/**
 * O `dist` do Vite e' estatico, mas o navegador precisa de UMA origem so.
 *
 * O cookie de sessao sai `SameSite=Lax` e sem `Domain` — host-only. Servir a
 * tela num host e a API em outro faria o navegador guardar o cookie no host da
 * API e nao mandar de volta em `fetch` de outro SITE; e em `*.fly.dev`, que
 * esta na Public Suffix List, dois subdominios sao sites DIFERENTES. O pai
 * entraria e continuaria deslogado, sem erro nenhum na tela.
 *
 * Por isso a imagem da web repassa `/v1` para a API, como o proxy do Vite faz
 * em desenvolvimento: mesma origem nos dois ambientes, e `VITE_API_BASE_URL`
 * segue vazia.
 */
const API_PREFIX = '/v1';
const HEALTH_PATH = '/health';
/** O robo do AdSense le na RAIZ do dominio; sem ele o pagamento fica retido. */
const ADS_TXT_PATH = '/ads.txt';
const INDEX_FILE = 'index.html';

/** Arquivo com hash no nome nunca muda de conteudo; o resto pode mudar hoje. */
const IMMUTABLE_PREFIX = '/assets/';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const REVALIDATE_CACHE = 'no-cache';

/**
 * Todas as interfaces, IPv4 e IPv6. O padrao do `Bun.serve` e' `0.0.0.0`, que
 * so atende IPv4 — e a rede privada do provedor e' IPv6.
 */
const SERVER_BIND_HOSTNAME = '::';

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;

const HOP_BY_HOP_HEADERS = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade'];

export function isApiPath(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/**
 * `..` no caminho pedido pelo navegador leria o disco inteiro. Normalizar nao
 * basta: o teto e' comparado DEPOIS de resolver, porque so ai `/assets/../..`
 * ja virou o que ele realmente aponta.
 */
export function resolveStaticPath({ distDirectory, pathname }) {
  const root = resolve(distDirectory);
  const candidate = resolve(join(root, normalize(decodeURIComponent(pathname))));

  if (candidate !== root && !candidate.startsWith(root + sep)) return undefined;
  return candidate;
}

export function chooseCacheControl(pathname) {
  return pathname.startsWith(IMMUTABLE_PREFIX) ? IMMUTABLE_CACHE : REVALIDATE_CACHE;
}

function buildForwardHeaders(request) {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  return headers;
}

async function forwardToApi({ request, apiOrigin }) {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);

  return fetch(target, {
    method: request.method,
    headers: buildForwardHeaders(request),
    body: request.body,
    redirect: 'manual',
  });
}

/**
 * Paginas publicas em HTML puro (`/sobre`, `/privacidade`, `/dicas/<artigo>`): o pai deslogado e o
 * robo do AdSense precisam le-las sem passar pelo login da SPA. O endereco
 * limpo vale pelo arquivo `.html` do mesmo nome — so quando ele existe; o resto
 * segue para o shell, e o roteador do navegador decide.
 */
const PUBLIC_PAGE_PATTERN = /^\/[a-z-]+(\/[a-z-]+)?$/;

async function serveStatic({ distDirectory, pathname }) {
  const candidates = PUBLIC_PAGE_PATTERN.test(pathname) ? [pathname, `${pathname}.html`] : [pathname];

  for (const candidate of candidates) {
    const filePath = resolveStaticPath({ distDirectory, pathname: candidate });
    if (filePath === undefined) continue;

    const file = Bun.file(filePath);
    if (!(await file.exists())) continue;

    return new Response(file, { headers: { 'Cache-Control': chooseCacheControl(candidate) } });
  }

  return undefined;
}

/**
 * A tela e' uma aplicacao de pagina unica: `/perfil` nao existe como arquivo, e
 * responder 404 ali quebraria recarregar a pagina em qualquer rota que nao a
 * raiz. Caminho desconhecido devolve o `index.html`, e o roteador do navegador
 * decide.
 */
const ADSENSE_ACCOUNT_META = 'google-adsense-account';

/**
 * A metatag do AdSense tambem entra AQUI, no boot, e nao so no build: o build
 * so a grava se o id chegar como build arg, e o robo do Google le o HTML que o
 * servidor entrega. Com o id no ambiente do container, um restart ja basta.
 */
export function withAdsenseAccountMeta(html, publisherId) {
  if (!publisherId || html.includes(ADSENSE_ACCOUNT_META)) return html;
  return html.replace('</head>', `<meta name="${ADSENSE_ACCOUNT_META}" content="${publisherId}" /></head>`);
}

async function serveApplicationShell(distDirectory, adsensePublisherId = '') {
  const shell = Bun.file(join(resolve(distDirectory), INDEX_FILE));
  if (!(await shell.exists())) return new Response('dist ausente', { status: HTTP_NOT_FOUND });

  const body = adsensePublisherId ? withAdsenseAccountMeta(await shell.text(), adsensePublisherId) : shell;

  return new Response(body, {
    headers: { 'Cache-Control': REVALIDATE_CACHE, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * `adsenseClientId` so vem com `ADS_ENABLED` ligado e abre a CSP;
 * `adsensePublisherId` e' o id cadastrado, e basta para o `ads.txt`.
 *
 * @param {{ port: number, distDirectory: string, apiOrigin: string, adsenseClientId?: string, adsensePublisherId?: string }} params
 */
export function createWebServer({
  port,
  distDirectory,
  apiOrigin,
  adsenseClientId = '',
  adsensePublisherId = adsenseClientId,
}) {
  const advertising = adsenseClientId.length > 0;
  const securityHeaders = buildSecurityHeaders({ advertising });
  const decorate = (response) => decorateWithSecurityHeaders(response, securityHeaders);

  return Bun.serve({
    hostname: SERVER_BIND_HOSTNAME,
    port,
    async fetch(request) {
      const { pathname } = new URL(request.url);

      /** Antes de qualquer coisa: nada de servir a tela do pai em texto puro. */
      const redirect = buildHttpsRedirect(request);
      if (redirect !== undefined) return redirect;

      /**
       * O repasse sai INTACTO: a API ja carimba os cabecalhos dela, e uma CSP
       * de documento colada em JSON so confunde quem for depurar. Tudo o que a
       * propria web produz passa pelo carimbo (`S-005`, security.md §3).
       */
      if (isApiPath(pathname)) {
        try {
          return await forwardToApi({ request, apiOrigin });
        } catch {
          /** A API fora do ar e' 502 aqui, nao 500: quem falhou foi o de tras. */
          return decorate(new Response(undefined, { status: HTTP_BAD_GATEWAY }));
        }
      }

      if (pathname === HEALTH_PATH) {
        return decorate(Response.json({ data: { status: 'ok' } }));
      }

      /** Sem id cadastrado, 404 de verdade — e nao o shell da SPA fingindo ser texto. */
      if (pathname === ADS_TXT_PATH) {
        if (adsensePublisherId.length === 0) return decorate(new Response('', { status: HTTP_NOT_FOUND }));
        return decorate(
          new Response(buildAdsTxt(adsensePublisherId), {
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': REVALIDATE_CACHE },
          }),
        );
      }

      const response =
        (await serveStatic({ distDirectory, pathname })) ??
        (await serveApplicationShell(distDirectory, adsensePublisherId));

      return decorate(response);
    },
  });
}
