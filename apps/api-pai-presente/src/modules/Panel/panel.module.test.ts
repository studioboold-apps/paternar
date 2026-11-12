/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { listSdkMigrations } from '../../database/sdk-migrations';
import { withTrackRateLimit } from '../Recommendation/recommendation.module';
import { createRateLimiter } from '../shared/http/rate-limit';
import { PANEL_SCOPES } from './panel.constant';
import { createPanelAuthResolver, scopesForRole } from './panel.module';

describe('papeis da equipe', () => {
  test('admin cria acessos; editor nao; viewer so le', () => {
    expect(scopesForRole('admin')).toContain(PANEL_SCOPES.USERS_ADMIN);
    expect(scopesForRole('editor')).not.toContain(PANEL_SCOPES.USERS_ADMIN);
    expect(scopesForRole('editor')).toContain(PANEL_SCOPES.RECOMMENDATIONS_ADMIN);
    expect(scopesForRole('viewer')).toEqual([PANEL_SCOPES.READ, PANEL_SCOPES.CUSTOMERS_READ]);
  });

  test('papel desconhecido nao ganha escopo nenhum', () => {
    expect(scopesForRole('superadmin')).toEqual([]);
  });
});

describe('sessao da equipe', () => {
  const resolver = createPanelAuthResolver({
    async verifyAccessToken(token) {
      return token === 'valido' ? { sub: 'u1', email: 'e@x.dev', role: 'editor' } : undefined;
    },
  });

  test('so aceita Bearer valido', async () => {
    expect(await resolver.resolve({ headers: {} })).toBeUndefined();
    expect(await resolver.resolve({ headers: { authorization: 'Bearer invalido' } })).toBeUndefined();
    expect(await resolver.resolve({ headers: { cookie: 'pp_access=qualquer' } })).toBeUndefined();
    const auth = await resolver.resolve({ headers: { authorization: 'Bearer valido' } });
    expect(auth?.userId).toBe('u1');
    expect(auth?.scopes).toContain(PANEL_SCOPES.RECOMMENDATIONS_ADMIN);
  });
});

describe('migrations do SDK', () => {
  test('usuarios, depois anunciantes, depois recomendacoes, depois notificacoes, cada um com journal proprio', () => {
    const migrations = listSdkMigrations('/pasta-que-nao-existe');
    expect(migrations.map((migration) => migration.name)).toEqual([
      'user-module',
      'customer-module',
      'recommendation-module',
      'notification-module',
    ]);
    expect(new Set(migrations.map((migration) => migration.table)).size).toBe(4);
  });
});

describe('rastreio de recomendacao', () => {
  test('a cota e por pai e so vale para o rastreio', async () => {
    const calls: string[] = [];
    const routes = withTrackRateLimit(
      [
        { method: 'POST', path: '/e', scope: 'user', operationId: 'trackRecommendationEvent', summary: '', handler: async () => (calls.push('track'), { kind: 'empty', status: 204 }) },
        { method: 'GET', path: '/f', scope: 'user', operationId: 'getRecommendationFeed', summary: '', handler: async () => (calls.push('feed'), { kind: 'empty', status: 200 }) },
      ],
      createRateLimiter({ maxRequests: 1, windowSeconds: 60 }),
    );
    const context = { params: {}, query: {}, body: undefined, headers: {}, auth: { companyId: 'x', userId: 'pai', scopes: [] } };
    await routes[0]?.handler(context);
    await expect(routes[0]!.handler(context)).rejects.toThrow();
    await routes[1]?.handler(context);
    await routes[1]?.handler(context);
    expect(calls).toEqual(['track', 'feed', 'feed']);
  });
});
