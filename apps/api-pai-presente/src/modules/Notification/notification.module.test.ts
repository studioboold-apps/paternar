/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';

import {
  buildNotificationModule,
  buildNotificationRouter,
} from './notification.module';
import { NOTIFICATION_COMPANY_ID } from './notification.constant';
import {
  DEFAULT_CATEGORY_POLICIES,
  DEFAULT_NOTIFICATION_TEMPLATES,
  bootstrapNotificationTemplates,
} from './seed-templates';

describe('notification module', () => {
  const dummyDatabase = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  } as unknown as Parameters<typeof buildNotificationModule>[0]['database'];

  const dummyAuthResolver = {
    resolve: async () => ({
      userId: 'user-123',
      email: 'pai@exemplo.com',
    }),
  };

  it('monta o modulo e o roteador com VAPID configurado', async () => {
    const notification = buildNotificationModule({
      database: dummyDatabase,
      suppressionHmacKey: 'test-hmac-key-min-length-required-1234567890',
      vapidKeys: {
        publicKey: 'test-vapid-public-key',
        privateKey: 'test-vapid-private-key',
        subject: 'mailto:teste@entrelacos.com.br',
      },
    });

    expect(notification).toBeDefined();
    expect(notification.useCases).toBeDefined();
    expect(notification.useCases.sendNotification).toBeDefined();
    expect(notification.useCases.registerDevice).toBeDefined();

    const router = buildNotificationRouter({
      notification,
      authenticatedUserResolver: dummyAuthResolver,
      vapidPublicKey: 'test-vapid-public-key',
    });

    expect(router.match(new Request('http://local/v1/notification-devices', { method: 'POST' }))).toBe(true);
    expect(router.match(new Request('http://local/v1/push/vapid-public-key', { method: 'GET' }))).toBe(true);
    expect(router.match(new Request('http://local/v1/notifications', { method: 'POST' }))).toBe(true);
    expect(router.match(new Request('http://local/v1/unknown-route', { method: 'GET' }))).toBe(false);

    // GET /v1/push/vapid-public-key devolve a chave publica configurada
    const res = await router.handle(new Request('http://local/v1/push/vapid-public-key', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { publicKey: string } };
    expect(body.data.publicKey).toBe('test-vapid-public-key');
  });

  it('monta o modulo sem VAPID e nao expoem /push/vapid-public-key', () => {
    const notification = buildNotificationModule({
      database: dummyDatabase,
      suppressionHmacKey: 'test-hmac-key-min-length-required-1234567890',
    });

    const router = buildNotificationRouter({
      notification,
      authenticatedUserResolver: dummyAuthResolver,
    });

    expect(router.match(new Request('http://local/v1/notification-devices', { method: 'POST' }))).toBe(true);
    expect(router.match(new Request('http://local/v1/push/vapid-public-key', { method: 'GET' }))).toBe(false);
  });

  it('NOTIFICATION_COMPANY_ID e um UUID valido para o PostgreSQL', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(NOTIFICATION_COMPANY_ID).toMatch(uuidRegex);
  });

  it('DEFAULT_NOTIFICATION_TEMPLATES cobre as 4 categorias nos 4 canais', () => {
    const categories = new Set(DEFAULT_NOTIFICATION_TEMPLATES.map((t) => t.key.split('.')[0]));
    expect(categories.has('atividades')).toBe(true);
    expect(categories.has('comunidade')).toBe(true);
    expect(categories.has('boletim')).toBe(true);
    expect(categories.has('avisos')).toBe(true);

    const channels = new Set(DEFAULT_NOTIFICATION_TEMPLATES.map((t) => t.channel));
    expect(channels.has('inbox')).toBe(true);
    expect(channels.has('push')).toBe(true);
    expect(channels.has('email')).toBe(true);
    expect(channels.has('whatsapp')).toBe(true);
  });

  it('DEFAULT_CATEGORY_POLICIES cobre as 4 categorias nos 4 canais ativados por padrao', () => {
    const categories = ['atividades', 'comunidade', 'boletim', 'avisos'];
    const channels = ['inbox', 'push', 'email', 'whatsapp'];

    for (const cat of categories) {
      for (const ch of channels) {
        const found = DEFAULT_CATEGORY_POLICIES.find((p) => p.category === cat && p.channel === ch);
        expect(found).toBeDefined();
        expect(found?.enabled).toBe(true);
      }
    }
  });

  it('bootstrapNotificationTemplates executa as insercoes com sucesso', async () => {
    const queries: unknown[] = [];
    const mockDb = {
      execute: async (query: unknown) => {
        queries.push(query);
      },
    } as unknown as Parameters<typeof bootstrapNotificationTemplates>[0];

    const result = await bootstrapNotificationTemplates(mockDb);
    expect(result.templatesCount).toBe(DEFAULT_NOTIFICATION_TEMPLATES.length);
    expect(result.policiesCount).toBe(DEFAULT_CATEGORY_POLICIES.length);
    expect(queries.length).toBe(DEFAULT_NOTIFICATION_TEMPLATES.length + DEFAULT_CATEGORY_POLICIES.length);
  });
});
