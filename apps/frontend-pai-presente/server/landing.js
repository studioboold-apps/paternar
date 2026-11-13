/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

/**
 * O dominio principal vira VITRINE, e o app muda para um subdominio
 * (`app.paternar.com.br`). Os dois saem da MESMA imagem e do MESMO servico: o
 * que separa um do outro e' o `Host` que o navegador pediu.
 *
 * No dominio da vitrine continuam de pe, exatamente onde estavam:
 * - `/v1/...`, porque o webhook da Hotmart ja aponta para
 *   `https://paternar.com.br/v1/payments/webhooks/hotmart` e nao pode quebrar;
 * - `/ads.txt` e a metatag do AdSense, que o Google confere na raiz do dominio;
 * - as paginas publicas (`/sobre`, `/privacidade`, `/dicas/...`), `robots.txt`
 *   e `sitemap.xml`;
 * - `/health`.
 *
 * Todo o resto (as rotas da SPA) vai para o app, com o mesmo caminho: quem
 * salvou `paternar.com.br/juntinhos` chega em `app.paternar.com.br/juntinhos`.
 *
 * Sem `LANDING_HOSTS`, nada disso liga: a imagem se comporta como sempre.
 */

const FORWARDED_HOST_HEADER = 'x-forwarded-host';
const HOST_HEADER = 'host';

/** Arquivo do `dist` que e' a vitrine (vem de `public/landing.html`). */
export const LANDING_FILE = 'landing.html';

/**
 * `302`, e nao `301`: o 301 fica guardado no navegador sem prazo, e voltar
 * atras (desligar a vitrine) deixaria quem ja passou por aqui preso no desvio.
 */
export const APP_REDIRECT_STATUS = 302;

/** O service worker do app, gerado pelo `vite-plugin-pwa`. */
export const SERVICE_WORKER_PATH = '/sw.js';

/** Tira a porta e as maiusculas: `Paternar.com.br:443` e' `paternar.com.br`. */
export function normalizeHost(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/** `"paternar.com.br, www.paternar.com.br"` -> conjunto com os dois. */
export function readLandingHosts(raw) {
  return new Set(
    String(raw ?? '')
      .split(',')
      .map(normalizeHost)
      .filter(Boolean),
  );
}

/**
 * O Railway entrega o `Host` original; `x-forwarded-host` vem primeiro porque
 * e' o que sobra quando ha mais de um proxy na frente (Cloudflare).
 */
export function requestHost(request) {
  return normalizeHost(request.headers.get(FORWARDED_HOST_HEADER) ?? request.headers.get(HOST_HEADER));
}

/** @param {Request} request @param {Set<string>} landingHosts */
export function isLandingRequest(request, landingHosts) {
  if (landingHosts.size === 0) return false;
  return landingHosts.has(requestHost(request));
}

/** O mesmo caminho e a mesma busca, no endereco do app. */
export function buildAppRedirectUrl(appUrl, pathname, search = '') {
  const target = new URL(appUrl);
  const path = pathname === '/index.html' ? '/' : pathname;
  return `${target.origin}${path}${search}`;
}

/**
 * O pai que instalou o app quando ele morava em `paternar.com.br` tem um
 * service worker ali que devolve a tela do app do cache, sem perguntar ao
 * servidor — ele nunca veria a vitrine nem seria desviado. O navegador confere
 * `/sw.js` a cada navegacao; neste dominio ele recebe ESTE arquivo, que limpa o
 * cache, se desregistra e recarrega a janela. Dai em diante vale o servidor:
 * vitrine em `/`, e o resto desviado para o app.
 */
export const RETIRING_SERVICE_WORKER = `// Este dominio agora e' a vitrine; o app mora em outro endereco.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) client.navigate(client.url);
  })());
});
`;
