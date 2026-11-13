/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O que o sininho precisa saber do app, separado do componente para ter teste.
 */

const API_VERSION_PATH = '/v1';

/**
 * As rotas da caixa de entrada vivem em `/v1/notifications` (mesmo prefixo do
 * resto da API). Vazio em desenvolvimento: o proxy do Vite leva `/v1` a API.
 * @param {string} apiBaseUrl
 */
export function buildNotificationBaseUrl(apiBaseUrl) {
  const base = (apiBaseUrl ?? '').replace(/\/+$/, '');
  return `${base}${API_VERSION_PATH}`;
}

/**
 * O SDK so tem portugues e ingles. Espanhol cai no portugues, que um
 * hispanofalante le melhor que ingles, e o titulo e o vazio vem traduzidos do
 * proprio app de qualquer forma.
 * @param {string | undefined} appLocale
 * @returns {'pt-BR' | 'en'}
 */
export function toNotificationLocale(appLocale) {
  return typeof appLocale === 'string' && appLocale.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
}
