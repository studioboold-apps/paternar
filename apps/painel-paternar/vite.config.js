/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_PREFIX = '/v1';

/**
 * Mesmo desenho da web dos pais: em desenvolvimento o Vite repassa `/v1` para a
 * API, e em producao quem repassa e' o servidor da imagem. O cookie de refresh
 * da equipe fica sempre na mesma origem da tela.
 */
function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nao definido — suba o painel por 'make dev-painel'.`);
  return value;
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server:
    command === 'serve'
      ? {
          port: Number(process.env.PAINEL_PORT ?? 5174),
          proxy: { [API_PREFIX]: { target: requireEnvironment('API_BASE_URL'), changeOrigin: true } },
        }
      : undefined,
}));
