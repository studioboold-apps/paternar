/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';
import type { ModuleRoute, RequestContext } from '@adatechnology/module-http';

import { withoutSponsoredFor } from './recommendation.module';

const FEED = {
  data: { entries: [{ itemId: 'a', sponsored: true }, { itemId: 'b', sponsored: false }] },
};

const routes: ModuleRoute[] = [
  {
    method: 'GET',
    path: '/recommendations',
    scope: 'user',
    operationId: 'getRecommendationFeed',
    summary: '',
    handler: async () => ({ kind: 'json', status: 200, body: FEED }),
  },
];

const contextOf = (userId: string) =>
  ({ params: {}, query: {}, body: undefined, headers: {}, auth: { companyId: 'c', userId, scopes: [] } }) as RequestContext;

describe('assinante sem anuncios', () => {
  test('quem tem o recurso nao recebe recomendacao patrocinada', async () => {
    const [feed] = withoutSponsoredFor(routes, async (userId) => userId === 'assinante');

    const subscriber = await feed!.handler(contextOf('assinante'));
    const free = await feed!.handler(contextOf('gratuito'));

    expect((subscriber as { body: typeof FEED }).body.data.entries.map((entry) => entry.itemId)).toEqual(['b']);
    expect((free as { body: typeof FEED }).body.data.entries.map((entry) => entry.itemId)).toEqual(['a', 'b']);
  });
});
