/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { resolveAppEnvironment } from './src/lib/environment.js';
import { adsenseAccountPlugin } from './build/adsense-account.plugin.js';
import { environmentIconPlugin } from './build/environment-icon.plugin.js';
import { PWA_MANIFEST, PWA_WORKBOX } from './build/pwa.config.js';

const API_PREFIX = '/v1';

/**
 * O `make` exporta o env do ambiente antes de chamar o Vite. Sem ele o proxy
 * apontaria para lugar nenhum e toda chamada voltaria 404 do proprio Vite —
 * falha que parece bug da API. Melhor nao subir.
 */
function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} nao definido — suba o frontend por 'make dev-web'.`);
  }
  return value;
}

/**
 * O identificador de cliente e o MESMO que a API usa para conferir o token, e
 * ele nao e segredo (`security.md` §4). Repeti-lo como `VITE_GOOGLE_CLIENT_ID`
 * no arquivo de env criaria duas verdades que so divergem no dia da rotacao —
 * o botao passaria a assinar com um id que a API nao aceita. Le-se um so, e o
 * prefixo `VITE_` fica no codigo dizendo "isto vai para o navegador".
 *
 * `APP_ENV` entra pela mesma porta: e' o ambiente do build, e a tela precisa
 * dele para decidir se mostra a faixa de aviso (`web.md` §12).
 */
/*
 * `ADSENSE_CLIENT_ID` e `ADSENSE_SLOT_ID` tambem sao publicos (saem no HTML de
 * todo site com anuncio). Nenhum anuncio e' desenhado sem `ADS_ENABLED=1`.
 */
const PUBLIC_ENVIRONMENT_NAMES = [
  'GOOGLE_CLIENT_ID',
  'APPLE_CLIENT_ID',
  'APP_ENV',
  'ADS_ENABLED',
  'ADSENSE_CLIENT_ID',
  'ADSENSE_SLOT_ID',
];

function definePublicEnvironment() {
  return Object.fromEntries(
    PUBLIC_ENVIRONMENT_NAMES.map((name) => [
      `import.meta.env.VITE_${name}`,
      JSON.stringify(process.env[name] ?? ''),
    ]),
  );
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    environmentIconPlugin({ environment: resolveAppEnvironment(process.env.APP_ENV) }),
    adsenseAccountPlugin({ clientId: process.env.ADSENSE_CLIENT_ID }),
    /**
     * `injectRegister` em arquivo, e nao inline: script inline no `index.html`
     * obrigaria `unsafe-inline` na CSP (`security.md` §3) so para registrar o
     * service worker.
     */
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: PWA_MANIFEST,
      workbox: PWA_WORKBOX,
    }),
  ],
  define: definePublicEnvironment(),
  /** O `@/` vinha do plugin deles; sem esta linha nenhum import resolve. */
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  /**
   * Em desenvolvimento o navegador fala com o proprio Vite e ele repassa para a
   * API. Sem isso o cookie de sessao seria de outra origem, e `SameSite` o
   * descartaria — o pai entraria e continuaria deslogado.
   */
  server:
    command === 'serve'
      ? {
          port: Number(requireEnvironment('WEB_PORT')),
          proxy: { [API_PREFIX]: { target: requireEnvironment('API_BASE_URL'), changeOrigin: true } },
        }
      : undefined,
}));
