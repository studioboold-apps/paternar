/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { createPanelClient } from './panel-client';

function json(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

function fakeFetch(handlers) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    calls.push({ url: String(url), method: init.method ?? 'GET', authorization: headers.get('Authorization') });
    const handler = handlers.shift();
    return handler ? handler(String(url), init) : json(500);
  };
  return { impl, calls };
}

describe('sessao da equipe', () => {
  test('entra, guarda o token em memoria e o manda como Bearer', async () => {
    const { impl, calls } = fakeFetch([
      () => json(200, { data: { accessToken: 'abc' } }),
      () => json(200, { data: { users: 3 } }),
    ]);
    const client = createPanelClient({ fetchImpl: impl });

    expect(await client.signIn({ email: 'e@x.dev', password: 'senha' })).toBe(true);
    const overview = await client.requestJson('GET', '/overview');

    expect(overview.data.users).toBe(3);
    expect(calls[1]).toMatchObject({ url: '/v1/panel/overview', authorization: 'Bearer abc' });
  });

  test('401 renova uma vez e repete com o token novo', async () => {
    const { impl, calls } = fakeFetch([
      () => json(401),
      () => json(200, { data: { accessToken: 'novo' } }),
      () => json(200, { data: [] }),
    ]);
    const client = createPanelClient({ fetchImpl: impl });

    await client.requestJson('GET', '/app-users');

    expect(calls.map((call) => call.url)).toEqual(['/v1/panel/app-users', '/v1/panel/auth/refresh', '/v1/panel/app-users']);
    expect(calls[2]?.authorization).toBe('Bearer novo');
  });

  test('renovacao recusada encerra a sessao e avisa quem escuta', async () => {
    const { impl } = fakeFetch([() => json(401), () => json(401)]);
    const client = createPanelClient({ fetchImpl: impl });
    const states = [];
    client.subscribe((signedIn) => states.push(signedIn));

    await expect(client.requestJson('GET', '/overview')).rejects.toThrow();
    expect(client.isSignedIn()).toBe(false);
    expect(states).toEqual([false]);
  });

  test('erro da API carrega status e codigo', async () => {
    const { impl } = fakeFetch([() => json(422, { error: { code: 'RECOMMENDATION_SPONSOR_REQUIRED', message: 'Precisa de anunciante.' } })]);
    const client = createPanelClient({ fetchImpl: impl });

    const failure = await client.requestJson('POST', '/recommendation-items', {}).catch((error) => error);
    expect(failure.status).toBe(422);
    expect(failure.code).toBe('RECOMMENDATION_SPONSOR_REQUIRED');
    expect(failure.message).toBe('Precisa de anunciante.');
  });
});
