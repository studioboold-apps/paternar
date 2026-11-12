/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { PWA_CACHE_NAMES } from '../src/lib/pwa-cache.js';

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const THIRTY_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 30;
const API_TIMEOUT_IN_SECONDS = 5;

/** A mesma cor do fundo do app, para a barra do sistema nao piscar branco. */
export const APP_THEME_COLOR = '#f6f5f0';

export const PWA_MANIFEST = Object.freeze({
  name: 'Paternar — Pai Presente',
  short_name: 'Paternar',
  description: 'Companhia diaria para pais que querem estar presentes.',
  lang: 'pt-BR',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: APP_THEME_COLOR,
  background_color: APP_THEME_COLOR,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    /**
     * O Android recorta o icone em circulo ou em bolha conforme o aparelho. Sem
     * uma variante `maskable`, a marca perde as bordas no recorte.
     */
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
});

export const PWA_WORKBOX = Object.freeze({
  globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  importScripts: ['/sw-push.js'],
  /**
   * Rota de SPA nao existe como arquivo: offline, qualquer caminho tem de cair
   * no shell ja precacheado. A API fica de fora — devolver HTML para quem
   * esperava JSON quebra o cliente com um erro que nao diz "voce esta offline".
   */
  navigateFallback: '/index.html',
  /**
   * As paginas publicas em HTML puro e os arquivos dos robos nao sao rota da
   * SPA: com o fallback, o pai com o app instalado abriria `/privacidade` e
   * cairia no login.
   */
  navigateFallbackDenylist: [/\/v1\//, /^\/(sobre|privacidade|dicas)(\.html)?$/, /^\/dicas\//, /^\/(ads|robots)\.txt$/, /^\/sitemap\.xml$/],
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: /\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: PWA_CACHE_NAMES.API,
        networkTimeoutSeconds: API_TIMEOUT_IN_SECONDS,
        /**
         * Validade curta porque isto e' dado pessoal em disco (`security.md`
         * §1). Sair da conta apaga este cache — ver `forgetCachedApiResponses`.
         */
        expiration: { maxEntries: 64, maxAgeSeconds: ONE_DAY_IN_SECONDS },
        cacheableResponse: { statuses: [200] },
      },
    },
    {
      urlPattern: /\.(?:png|svg|webp|woff2)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: PWA_CACHE_NAMES.ASSETS,
        expiration: { maxEntries: 64, maxAgeSeconds: THIRTY_DAYS_IN_SECONDS },
      },
    },
  ],
});
