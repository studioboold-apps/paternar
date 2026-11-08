/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O painel e o feed de recomendacoes contra o banco de verdade, com os modulos
 * do SDK compostos como o `main.ts` compoe. Em processo, sem subir servidor:
 * o que se prova aqui e' a fiacao entre o app e os pacotes (drizzle 0.4x com
 * bun-sql, sessao da equipe separada da dos pais, anunciante -> recomendacao ->
 * feed). Nenhuma IA e' chamada.
 *
 * Roda com `PP_E2E=1` e as migrations aplicadas (`make migrate`).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { createDatabaseClient, type Database } from '../database/client';
import { buildPanelModule, type PanelModule } from '../modules/Panel/panel.module';
import { PANEL_BASE_PATH } from '../modules/Panel/panel.constant';
import { buildRecommendationFeedRouter, buildSdkModules } from '../modules/Recommendation/recommendation.module';
import { usersTable } from '../modules/User/user.table';

const IS_ENABLED = Bun.env.PP_E2E === '1' && Boolean(Bun.env.DATABASE_URL);
const RUN_ID = randomUUID().slice(0, 8);
const ADMIN_EMAIL = `equipe-${RUN_ID}@teste.dev`;
const ADMIN_PASSWORD = 'senha-de-teste-123';
const PARENT_ID = randomUUID();

describe.skipIf(!IS_ENABLED)('painel e recomendacoes (e2e em processo)', () => {
  let database: Database;
  let panel: PanelModule;
  let feed: ReturnType<typeof buildRecommendationFeedRouter>;
  let token = '';

  async function panelCall(method: string, path: string, body?: unknown, bearer = token) {
    const response = await panel.router.handle(
      new Request(`http://local${PANEL_BASE_PATH}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as Record<string, any>) : undefined };
  }

  beforeAll(async () => {
    database = createDatabaseClient(Bun.env.DATABASE_URL ?? '');
    await database.insert(usersTable).values({ id: PARENT_ID, email: `pai-${RUN_ID}@teste.dev`, fullName: 'Pai de Teste', city: 'Ribeirão Preto' });

    const sdk = buildSdkModules({ database });
    panel = await buildPanelModule({
      database,
      customers: sdk.customers,
      recommendations: sdk.recommendations,
      jwtSecret: 'segredo-do-painel-de-teste-com-32-caracteres',
      firstAdmin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    await panel.bootstrap();
    // Segundo boot: nao duplica acesso nem categoria.
    await panel.bootstrap();

    feed = buildRecommendationFeedRouter({
      recommendations: sdk.recommendations,
      authenticatedUserResolver: {
        async resolve(request) {
          return request.headers.get('cookie') === 'pai=1' ? { userId: PARENT_ID, email: 'pai@teste.dev' } : undefined;
        },
      },
    });
  });

  afterAll(async () => {
    await database.execute(sql`delete from ${usersTable} where ${usersTable.id} = ${PARENT_ID}`);
    await database.execute(sql`delete from "user"."users" where email = ${ADMIN_EMAIL}`);
  });

  test('sem token da equipe nada abre; token de pai tambem nao', async () => {
    expect((await panelCall('GET', '/overview', undefined, '')).status).toBe(401);
    expect((await panelCall('GET', '/overview', undefined, 'token-qualquer')).status).toBe(401);
  });

  test('a equipe entra com e-mail e senha e ve os cadastros de pais', async () => {
    const login = await panelCall('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, '');
    expect(login.status).toBe(200);
    token = login.body?.['data']['accessToken'];
    expect(typeof token).toBe('string');

    const overview = await panelCall('GET', '/overview');
    expect(overview.status).toBe(200);
    expect(overview.body?.['data']['users']).toBeGreaterThanOrEqual(1);

    const users = await panelCall('GET', `/app-users?search=pai-${RUN_ID}`);
    expect(users.status).toBe(200);
    expect(users.body?.['data']).toHaveLength(1);
    expect(users.body?.['data'][0]).toMatchObject({ fullName: 'Pai de Teste', city: 'Ribeirão Preto', childrenCount: 0 });
    // O painel nao devolve foto, idade nem estado civil.
    expect(Object.keys(users.body?.['data'][0]).sort()).toEqual(
      ['blockedAt', 'childrenCount', 'city', 'createdAt', 'email', 'fullName', 'id', 'onboardingCompleted'].sort(),
    );
  });

  test('admin bloqueia o pai, e libera depois', async () => {
    const blocked = await panelCall('PUT', `/app-users/${PARENT_ID}/blocked`, { blocked: true });
    expect(blocked.status).toBe(200);
    const [row] = await database.select({ blockedAt: usersTable.blockedAt }).from(usersTable).where(sql`${usersTable.id} = ${PARENT_ID}`);
    expect(row?.blockedAt).toBeInstanceOf(Date);

    const listed = await panelCall('GET', `/app-users?search=pai-${RUN_ID}`);
    expect(listed.body?.['data'][0]['blockedAt']).toBeTruthy();

    const released = await panelCall('PUT', `/app-users/${PARENT_ID}/blocked`, { blocked: false });
    expect(released.body?.['data']['blockedAt']).toBeNull();
  });

  test('anunciante com categoria vira recomendacao patrocinada que aparece no feed do pai', async () => {
    const settings = await panelCall('GET', '/customer-settings');
    const categoria = (settings.body?.['data']['fieldCatalog'] as { name: string }[]).filter((field) => field.name === 'categoria');
    expect(categoria).toHaveLength(1);

    const advertiser = await panelCall('POST', '/customers', {
      name: `Buffet ${RUN_ID}`,
      phones: [{ number: `1699${String(Date.now()).slice(-7)}`, isWhatsApp: true }],
      attributes: { categoria: 'buffet' },
    });
    expect(advertiser.status).toBe(201);
    const sponsorId = advertiser.body?.['data']['id'];

    const item = await panelCall('POST', '/recommendation-items', {
      kind: 'place',
      source: 'sponsored',
      status: 'active',
      sponsorId,
      title: `Buffet infantil ${RUN_ID}`,
      city: 'Ribeirão Preto',
      linkUrl: 'https://exemplo.com.br',
      attributes: { category: 'buffet', free: false },
    });
    expect(item.status).toBe(201);
    const itemId = item.body?.['data']['id'];

    const campaign = await panelCall('POST', `/recommendation-items/${itemId}/campaigns`, {
      plan: 'featured',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      placements: ['home'],
    });
    expect(campaign.status).toBe(201);

    const anonymous = await feed.handle(new Request('http://local/v1/recommendations?placement=home'));
    expect(anonymous.status).toBe(401);

    const response = await feed.handle(
      new Request('http://local/v1/recommendations?placement=home&city=Ribeir%C3%A3o%20Preto', { headers: { cookie: 'pai=1' } }),
    );
    expect(response.status).toBe(200);
    const entries = ((await response.json()) as { data: { entries: { itemId: string; sponsored: boolean }[] } }).data.entries;
    expect(entries[0]).toMatchObject({ itemId, sponsored: true });

    const click = await feed.handle(
      new Request('http://local/v1/recommendations/events', {
        method: 'POST',
        headers: { cookie: 'pai=1', 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, campaignId: campaign.body?.['data']['id'], placement: 'home', type: 'click' }),
      }),
    );
    expect(click.status).toBe(204);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const stats = await panelCall('GET', `/recommendation-stats?from=${today}&to=${today}&itemId=${itemId}`);
    expect(stats.body?.['data']).toEqual([
      { itemId, campaignId: campaign.body?.['data']['id'], placement: 'home', impressions: 0, clicks: 1 },
    ]);
  });
});
