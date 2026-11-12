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
});
