/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';

import { createModuleFetchRouter } from '@adatechnology/module-http/fetch';
import type { NotificationModule } from '@adatechnology/notification-module';

import type { SendTemplateTest } from '../Notification/template-test';
import { buildPanelNotificationRoutes } from './panel-notification.routes';
import { PANEL_BASE_PATH, PANEL_ROLES, PANEL_SCOPES, SCOPES_BY_ROLE, type PanelRole } from './panel.constant';

const STAFF_ID = '11111111-1111-4111-8111-111111111111';

/** O SDK so precisa de `useCases` para montar as rotas; nada aqui toca banco. */
const fakeNotification = {
  useCases: new Proxy({}, { get: () => ({ execute: async () => [] }) }),
  standardEmail: {},
  templateVariables: {},
} as unknown as NotificationModule;

function buildRouter(role: PanelRole, sendTemplateTest: SendTemplateTest) {
  return createModuleFetchRouter({
    basePath: PANEL_BASE_PATH,
    routes: buildPanelNotificationRoutes({ notification: fakeNotification, sendTemplateTest }),
    authResolver: {
      async resolve() {
        return { companyId: 'empresa', userId: STAFF_ID, scopes: [...SCOPES_BY_ROLE[role]] };
      },
    },
  });
}

const neverCalled: SendTemplateTest = async () => {
  throw new Error('nao devia enviar');
};

function call(router: ReturnType<typeof buildRouter>, method: string, path: string) {
  return router.handle(new Request(`http://local${PANEL_BASE_PATH}${path}`, { method }));
}

describe('notificacoes no painel', () => {
  it('editor e admin tem o escopo de notificacoes; quem so olha, nao', () => {
    expect(SCOPES_BY_ROLE[PANEL_ROLES.ADMIN]).toContain(PANEL_SCOPES.NOTIFICATIONS_ADMIN);
    expect(SCOPES_BY_ROLE[PANEL_ROLES.EDITOR]).toContain(PANEL_SCOPES.NOTIFICATIONS_ADMIN);
    expect(SCOPES_BY_ROLE[PANEL_ROLES.VIEWER]).not.toContain(PANEL_SCOPES.NOTIFICATIONS_ADMIN);
  });

  it('quem so olha nao altera modelo nem envia teste', async () => {
    const router = buildRouter(PANEL_ROLES.VIEWER, neverCalled);
    expect((await call(router, 'POST', '/notification-templates')).status).toBe(403);
    expect((await call(router, 'POST', '/notification-templates/avisos.plataforma/test')).status).toBe(403);
  });

  it('nao publica no painel o disparo livre para qualquer pai', () => {
    const router = buildRouter(PANEL_ROLES.ADMIN, neverCalled);
    const at = (method: string, path: string) =>
      router.match(new Request(`http://local${PANEL_BASE_PATH}${path}`, { method }));
    expect(at('POST', '/notifications')).toBe(false);
    // A tela de configuracoes do SDK le as preferencias de quem esta logado.
    expect(at('GET', '/notification-preferences')).toBe(true);
    expect(at('GET', '/notification-templates')).toBe(true);
  });

  it('o teste vai para quem esta logado, sem destinatario no corpo, e responde 202', async () => {
    const calls: Parameters<SendTemplateTest>[0][] = [];
    const router = buildRouter(PANEL_ROLES.EDITOR, async (input) => {
      calls.push(input);
      return { notificationId: 'n1', templateKey: input.templateKey, category: 'atividades', deliveries: [] };
    });

    const response = await call(router, 'POST', '/notification-templates/atividade_lembrete/test');

    expect(response.status).toBe(202);
    expect(calls).toEqual([{ staffUserId: STAFF_ID, templateKey: 'atividade_lembrete' }]);
    const body = (await response.json()) as { data: { notificationId: string } };
    expect(body.data.notificationId).toBe('n1');
  });
});
