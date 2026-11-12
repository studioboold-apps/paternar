/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Ficha do pai, uso, custo de IA e denuncias contra o banco de verdade: o SQL
 * destas rotas so' se prova rodando. Nenhuma IA e' chamada — o uso de IA e'
 * gravado direto, como o provedor gravaria.
 *
 * Roda com `PP_E2E=1` e as migrations aplicadas (`make migrate`).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { buildApplicationRoutes } from '../app';
import { createDatabaseClient, type Database } from '../database/client';
import { createDatabaseAiUsageRecorder } from '../modules/AiUsage/ai-usage.repository';
import { activitiesTable } from '../modules/Activity/activity.table';
import { chatMessagesTable } from '../modules/ChatMessage/chat-message.table';
import { communityPostsTable } from '../modules/CommunityPost/community-post.table';
import { buildPanelModule, type PanelModule } from '../modules/Panel/panel.module';
import { PANEL_BASE_PATH } from '../modules/Panel/panel.constant';
import { buildSdkModules } from '../modules/Recommendation/recommendation.module';
import { createRouter } from '../modules/shared/http/router';
import { usersTable } from '../modules/User/user.table';

const IS_ENABLED = Bun.env.PP_E2E === '1' && Boolean(Bun.env.DATABASE_URL);
const RUN_ID = randomUUID().slice(0, 8);
const ADMIN_EMAIL = `equipe-insights-${RUN_ID}@teste.dev`;
const ADMIN_PASSWORD = 'senha-de-teste-123';
const AUTHOR_ID = randomUUID();
const REPORTER_ID = randomUUID();
const POST_ID = randomUUID();

describe.skipIf(!IS_ENABLED)('painel: ficha, uso, IA e denuncias (e2e em processo)', () => {
  let database: Database;
  let panel: PanelModule;
  let app: ReturnType<typeof createRouter>;
  let token = '';

  async function panelCall(method: string, path: string, body?: unknown) {
    const response = await panel.router.handle(
      new Request(`http://local${PANEL_BASE_PATH}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as Record<string, any>) : undefined };
  }

  async function appCall(method: string, path: string, userId: string, body?: unknown) {
    const response = await app.handle(
      new Request(`http://local${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-test-user': userId, origin: 'http://localhost' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as Record<string, any>) : undefined };
  }

  beforeAll(async () => {
    database = createDatabaseClient(Bun.env.DATABASE_URL ?? '');
    await database.insert(usersTable).values([
      { id: AUTHOR_ID, email: `autor-${RUN_ID}@teste.dev`, fullName: 'Autor de Teste', onboardingCompleted: true },
      { id: REPORTER_ID, email: `denunciante-${RUN_ID}@teste.dev`, fullName: 'Denunciante' },
    ]);
    await database.insert(communityPostsTable).values({ id: POST_ID, authorId: AUTHOR_ID, content: `post ruim ${RUN_ID}`, category: 'geral' });
    await database.insert(activitiesTable).values({ userId: AUTHOR_ID, title: 'Pizza com o Joao', activityDate: '2026-11-01', category: 'culinaria', isCompleted: true });
    await database.insert(chatMessagesTable).values([
      { userId: AUTHOR_ID, conversationId: AUTHOR_ID, role: 'user', content: 'segredo da conversa' },
      { userId: AUTHOR_ID, conversationId: AUTHOR_ID, role: 'assistant', content: 'resposta' },
    ]);
    const record = createDatabaseAiUsageRecorder(database);
    record({ provider: 'anthropic', model: 'claude-haiku-5-5', task: 'chat', userId: AUTHOR_ID, inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const sdk = buildSdkModules({ database });
    panel = await buildPanelModule({
      database,
      customers: sdk.customers,
      recommendations: sdk.recommendations,
      jwtSecret: 'segredo-do-painel-de-teste-com-32-caracteres',
      firstAdmin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    await panel.bootstrap();
    const login = await panelCall('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    token = login.body?.['data']['accessToken'];

    app = createRouter({
      routes: buildApplicationRoutes({
        database,
        llm: { providerName: 'anthropic', apiKey: '', model: '', transcription: { apiKey: '', model: '' } },
        media: { destination: 'local', directory: '/tmp', bucket: '', endpoint: '', encryptionKey: '' } as never,
      }),
      publicRoutes: [],
      authenticatedUserResolver: {
        async resolve(request: Request) {
          const userId = request.headers.get('x-test-user');
          return userId ? { userId, email: 'pai@teste.dev' } : undefined;
        },
      },
    } as never);
  });

  afterAll(async () => {
    await database.execute(sql`delete from audit_log where target_id in (${AUTHOR_ID}, ${REPORTER_ID})`);
    await database.execute(sql`delete from ai_usage where user_id = ${AUTHOR_ID}`);
    await database.execute(sql`delete from ${usersTable} where ${usersTable.id} in (${AUTHOR_ID}, ${REPORTER_ID})`);
    await database.execute(sql`delete from "user"."users" where email = ${ADMIN_EMAIL}`);
  });

  test('o pai denuncia um post pelo app, e denunciar de novo nao duplica', async () => {
    const first = await appCall('POST', `/v1/community/posts/${POST_ID}/reports`, REPORTER_ID, { reason: 'ofensivo', details: 'xingou' });
    expect(first.status).toBe(201);
    const again = await appCall('POST', `/v1/community/posts/${POST_ID}/reports`, REPORTER_ID, { reason: 'ofensivo' });
    expect(again.status).toBe(200);
    expect(again.body?.['data']['id']).toBe(first.body?.['data']['id']);
  });

  test('a ficha traz numeros e linha do tempo, sem o texto da conversa, e registra quem viu', async () => {
    const response = await panelCall('GET', `/app-users/${AUTHOR_ID}`);
    expect(response.status).toBe(200);
    const detail = response.body?.['data'];
    expect(detail.profile).toMatchObject({ id: AUTHOR_ID, fullName: 'Autor de Teste', blockedAt: null });
    expect(detail.stats).toMatchObject({
      activities: 1,
      activitiesCompleted: 1,
      posts: 1,
      chatMessages: 1,
      reportsReceived: 1,
      reportsReceivedOpen: 1,
      aiCalls: 1,
      aiCostMicroUsd: 100_000,
    });
    const kinds = (detail.timeline as { kind: string }[]).map((event) => event.kind);
    expect(kinds).toEqual(expect.arrayContaining(['signup', 'activity', 'activity_done', 'post', 'chat', 'ai', 'report_received']));
    expect(JSON.stringify(detail)).not.toContain('segredo da conversa');
    expect(JSON.stringify(detail)).not.toContain('Pizza com o Joao');

    const again = await panelCall('GET', `/app-users/${AUTHOR_ID}`);
    expect(again.body?.['data']['teamViews'][0]['actorEmail']).toBe(ADMIN_EMAIL);

    const trail = await panelCall('GET', '/team-access');
    expect(trail.status).toBe(200);
    expect(trail.body?.['data'][0]).toMatchObject({ action: 'panel_user_viewed', actorEmail: ADMIN_EMAIL, targetId: AUTHOR_ID });
  });

  test('pai que nao existe responde 404', async () => {
    expect((await panelCall('GET', `/app-users/${randomUUID()}`)).status).toBe(404);
  });

  test('engajamento e custo de IA respondem com os numeros do banco', async () => {
    const engagement = await panelCall('GET', '/engagement');
    expect(engagement.status).toBe(200);
    expect(engagement.body?.['data']['activeUsers30']).toBeGreaterThanOrEqual(1);
    expect(engagement.body?.['data']['openReports']).toBeGreaterThanOrEqual(1);
    expect(engagement.body?.['data']['funnel']['users']).toBeGreaterThanOrEqual(2);

    const usage = await panelCall('GET', '/ai-usage?days=7');
    expect(usage.status).toBe(200);
    expect(usage.body?.['data']['totals']['costMicroUsd']).toBeGreaterThanOrEqual(100_000);
    expect(usage.body?.['data']['topUsers']).toEqual(expect.arrayContaining([expect.objectContaining({ id: AUTHOR_ID, calls: 1 })]));
  });

  test('a equipe remove o post denunciado; a denuncia fica, com a copia do texto', async () => {
    const open = await panelCall('GET', '/reports?status=open&perPage=100');
    const report = (open.body?.['data'] as { id: string; postId: string }[]).find((entry) => entry.postId === POST_ID);
    expect(report).toMatchObject({ contentOnline: true, openOnSameContent: 1, reason: 'ofensivo' });

    const resolved = await panelCall('POST', `/reports/${report?.id}/resolve`, { action: 'remove' });
    expect(resolved.status).toBe(200);
    expect(resolved.body?.['data']).toEqual({ closed: 1, removedContent: true });

    const removed = await panelCall('GET', '/reports?status=removed&perPage=100');
    const after = (removed.body?.['data'] as { id: string }[]).find((entry) => entry.id === report?.id);
    expect(after).toMatchObject({ contentOnline: false, contentSnapshot: `post ruim ${RUN_ID}`, resolvedByEmail: ADMIN_EMAIL });

    const [post] = await database.select().from(communityPostsTable).where(sql`${communityPostsTable.id} = ${POST_ID}`);
    expect(post).toBeUndefined();
  });

  test('/me diz o que a equipe pode fazer', async () => {
    const me = await panelCall('GET', '/me');
    expect(me.body?.['data']['scopes']).toEqual(expect.arrayContaining(['panel:read', 'community:moderate', 'app-users:block']));
  });
});
