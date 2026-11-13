/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { createModuleFetchRouter } from '@adatechnology/module-http/fetch';
import { USER_ERROR_CODE } from '@adatechnology/user-contracts';

import { listSdkMigrations } from '../../database/sdk-migrations';
import { withTrackRateLimit } from '../Recommendation/recommendation.module';
import { createRateLimiter } from '../shared/http/rate-limit';
import { PANEL_BASE_PATH, PANEL_SCOPES } from './panel.constant';
import { createPanelAuthResolver, ensureFirstAdmin, scopesForRole } from './panel.module';
import { buildPanelRoutes } from './panel.routes';

describe('papeis da equipe', () => {
  test('admin cria acessos; editor nao; viewer so le', () => {
    expect(scopesForRole('admin')).toContain(PANEL_SCOPES.USERS_ADMIN);
    expect(scopesForRole('editor')).not.toContain(PANEL_SCOPES.USERS_ADMIN);
    expect(scopesForRole('admin')).toContain(PANEL_SCOPES.APP_USERS_BLOCK);
    expect(scopesForRole('editor')).not.toContain(PANEL_SCOPES.APP_USERS_BLOCK);
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
  test('usuarios, depois anunciantes, depois recomendacoes, depois notificacoes, depois pagamentos, cada um com journal proprio', () => {
    const migrations = listSdkMigrations('/pasta-que-nao-existe');
    expect(migrations.map((migration) => migration.name)).toEqual([
      'user-module',
      'customer-module',
      'recommendation-module',
      'notification-module',
      'payment-module',
    ]);
    expect(new Set(migrations.map((migration) => migration.table)).size).toBe(5);
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

describe('primeiro acesso e recuperacao do admin', () => {
  const ADMIN = { email: 'admin@exemplo.dev', password: 'senha-nova-bem-longa' };
  const alreadyExists = Object.assign(new Error('existe'), { code: USER_ERROR_CODE.EMAIL_ALREADY_EXISTS });

  function fakes(createError?: Error) {
    const calls = { created: 0, resets: [] as { email: string; password: string }[] };
    return {
      calls,
      createUser: async () => {
        calls.created += 1;
        if (createError) throw createError;
      },
      resetAdminPassword: async (input: { email: string; password: string }) => {
        calls.resets.push(input);
        return 1;
      },
    };
  }

  test('sem a flag, admin que ja existe fica com a senha que tinha', async () => {
    const deps = fakes(alreadyExists);
    await ensureFirstAdmin({ ...deps, firstAdmin: ADMIN });
    expect(deps.calls.resets).toEqual([]);
  });

  test('com a flag, admin que ja existe ganha a senha da variavel', async () => {
    const deps = fakes(alreadyExists);
    await ensureFirstAdmin({ ...deps, firstAdmin: { ...ADMIN, resetPassword: true } });
    expect(deps.calls.resets).toEqual([ADMIN]);
  });

  test('admin novo e criado e nao precisa de reset', async () => {
    const deps = fakes();
    await ensureFirstAdmin({ ...deps, firstAdmin: { ...ADMIN, resetPassword: true } });
    expect(deps.calls.created).toBe(1);
    expect(deps.calls.resets).toEqual([]);
  });

  test('lista separada por virgula cria cada admin e reseta os que ja existem', async () => {
    const created: string[] = [];
    const resets: string[] = [];
    await ensureFirstAdmin({
      firstAdmin: { email: ' a@x.dev , b@x.dev ', password: ADMIN.password, resetPassword: true },
      createUser: async (input) => {
        created.push(input.email);
        if (input.email === 'a@x.dev') throw alreadyExists;
      },
      resetAdminPassword: async (input) => (resets.push(input.email), 1),
    });
    expect(created).toEqual(['a@x.dev', 'b@x.dev']);
    expect(resets).toEqual(['a@x.dev']);
  });

  test('sem e-mail ou senha nao faz nada', async () => {
    const empty = fakes();
    await ensureFirstAdmin({ ...empty, firstAdmin: { email: '', password: '', resetPassword: true } });
    expect(empty.calls.created).toBe(0);
  });

  test('senha curta nao cria nem reseta ninguem, e nao derruba o boot', async () => {
    const deps = fakes(alreadyExists);
    await ensureFirstAdmin({ ...deps, firstAdmin: { ...ADMIN, password: 'curta', resetPassword: true } });
    expect(deps.calls.created).toBe(0);
    expect(deps.calls.resets).toEqual([]);
  });

  test('erro num acesso nao derruba o boot nem impede o proximo', async () => {
    const created: string[] = [];
    await ensureFirstAdmin({
      firstAdmin: { email: 'quebrado@x.dev,b@x.dev', password: ADMIN.password },
      createUser: async (input) => {
        created.push(input.email);
        if (input.email === 'quebrado@x.dev') throw new Error('banco fora');
      },
      resetAdminPassword: async () => 1,
    });
    expect(created).toEqual(['quebrado@x.dev', 'b@x.dev']);
  });

  test('aspas coladas junto com o valor saem do e-mail e da senha', async () => {
    const seen: { email: string; password: string }[] = [];
    await ensureFirstAdmin({
      firstAdmin: { email: '"a@x.dev,b@x.dev"', password: `"${ADMIN.password}"` },
      createUser: async (input) => void seen.push({ email: input.email, password: input.password }),
      resetAdminPassword: async () => 1,
    });
    expect(seen).toEqual([
      { email: 'a@x.dev', password: ADMIN.password },
      { email: 'b@x.dev', password: ADMIN.password },
    ]);
  });
});

describe('bloqueio de pais pelo painel', () => {
  const PARENT_ID = '7d3f5f7e-9a51-4d8e-9f0c-1f2a3b4c5d6e';

  function buildRouter(role: string) {
    const calls: { userId: string; blocked: boolean }[] = [];
    const repository = {
      overview: async () => ({}) as never,
      listUsers: async () => ({ rows: [], total: 0 }),
      async setUserBlocked(input: { userId: string; blocked: boolean }) {
        calls.push(input);
        if (input.userId !== PARENT_ID) return undefined;
        return { id: input.userId, blockedAt: input.blocked ? new Date('2026-11-08T12:00:00Z') : null };
      },
    };
    const router = createModuleFetchRouter({
      routes: buildPanelRoutes(repository),
      basePath: PANEL_BASE_PATH,
      authResolver: { resolve: async () => ({ companyId: 'entrelacos', userId: 'equipe', scopes: scopesForRole(role) }) },
    });
    const put = (userId: string, body: unknown) =>
      router.handle(
        new Request(`http://local${PANEL_BASE_PATH}/app-users/${userId}/blocked`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
    return { calls, put };
  }

  test('admin bloqueia e libera', async () => {
    const { calls, put } = buildRouter('admin');

    const blocked = await put(PARENT_ID, { blocked: true });
    expect(blocked.status).toBe(200);
    expect(((await blocked.json()) as { data: { blockedAt: string } }).data.blockedAt).toBeTruthy();

    const released = await put(PARENT_ID, { blocked: false });
    expect(((await released.json()) as { data: { blockedAt: unknown } }).data.blockedAt).toBeNull();
    expect(calls).toEqual([
      { userId: PARENT_ID, blocked: true },
      { userId: PARENT_ID, blocked: false },
    ]);
  });

  test('editor e viewer nao bloqueiam ninguem', async () => {
    for (const role of ['editor', 'viewer']) {
      const { calls, put } = buildRouter(role);
      expect((await put(PARENT_ID, { blocked: true })).status).toBe(403);
      expect(calls).toEqual([]);
    }
  });

  test('pai inexistente da 404; pedido torto da 400', async () => {
    const { put } = buildRouter('admin');
    expect((await put('2b1c0d9e-8f7a-4b6c-9d5e-4f3a2b1c0d9e', { blocked: true })).status).toBe(404);
    expect((await put('nao-e-uuid', { blocked: true })).status).toBe(400);
    expect((await put(PARENT_ID, { blocked: 'sim' })).status).toBe(400);
  });
});
