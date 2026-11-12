/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A sessao da EQUIPE no painel. E' outra sessao, do `user-module` do SDK: o
 * token de acesso vive so em memoria (nunca em localStorage, onde qualquer
 * script da pagina o leria) e o refresh vive num cookie HttpOnly que a API
 * emite. Recarregar a pagina custa um `POST /auth/refresh`, e nada mais.
 */

export const PANEL_API_PREFIX = '/v1/panel';

const HTTP_UNAUTHORIZED = 401;

/**
 * @param {{ baseUrl?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createPanelClient({ baseUrl = '', fetchImpl = (...args) => fetch(...args) } = {}) {
  const root = `${baseUrl}${PANEL_API_PREFIX}`;
  let accessToken = '';
  let refreshInFlight = null;
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(Boolean(accessToken)));

  async function readSession(response) {
    if (!response.ok) return false;
    const payload = await response.json().catch(() => undefined);
    accessToken = payload?.data?.accessToken ?? '';
    notify();
    return Boolean(accessToken);
  }

  /** Uma renovacao por vez: duas em paralelo invalidariam uma a outra na rotacao. */
  function refresh() {
    refreshInFlight ??= fetchImpl(`${root}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(readSession)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  }

  function withToken(init = {}) {
    const headers = new Headers(init.headers ?? {});
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return { ...init, headers, credentials: 'include' };
  }

  /**
   * `fetch` com o token da equipe. Um 401 tenta renovar UMA vez e repete; se a
   * renovacao falha, a sessao acabou e a tela volta para o login.
   */
  async function authorizedFetch(input, init = {}) {
    const response = await fetchImpl(input, withToken(init));
    if (response.status !== HTTP_UNAUTHORIZED) return response;
    if (!(await refresh())) {
      accessToken = '';
      notify();
      return response;
    }
    return fetchImpl(input, withToken(init));
  }

  return {
    root,
    authorizedFetch,
    restore: refresh,
    isSignedIn: () => Boolean(accessToken),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn({ email, password }) {
      const response = await fetchImpl(`${root}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return readSession(response);
    },
    async signOut() {
      await authorizedFetch(`${root}/auth/logout`, { method: 'POST' }).catch(() => undefined);
      accessToken = '';
      notify();
    },
    /** GET/POST/PATCH em JSON, devolvendo o corpo inteiro (`{ data, pagination }`). */
    async requestJson(method, path, body) {
      const response = await authorizedFetch(`${root}${path}`, {
        method,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      });
      if (response.status === 204) return undefined;
      const payload = await response.json().catch(() => undefined);
      if (!response.ok) {
        const error = new Error(payload?.error?.message ?? `A API respondeu ${response.status}.`);
        error.status = response.status;
        error.code = payload?.error?.code;
        throw error;
      }
      return payload;
    },
  };
}
