/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Notificacoes no painel: as rotas de modelos e politicas do SDK, com escopo
 * de equipe, e o "Enviar teste para mim" do editor.
 */

import { ROUTE_SCOPE, type ModuleRoute } from '@adatechnology/module-http';
import { createNotificationRoutes, type NotificationModule } from '@adatechnology/notification-module';

import type { SendTemplateTest } from '../Notification/template-test';
import { PANEL_SCOPES } from './panel.constant';

/**
 * As rotas `admin` do SDK nao pedem escopo: no painel, qualquer acesso logado
 * (ate o "so olha") editaria o texto que chega a todos os pais. Ler pede
 * `panel:read`; mudar pede `notifications:admin` (admin e editor).
 *
 * As rotas `user` ficam: a tela de configuracoes do SDK le e grava as
 * preferencias de quem esta logado. A `service` (disparar para qualquer pai
 * pelo id) nao tem uso no painel e fica fora.
 */
export function buildPanelNotificationRoutes(params: {
  readonly notification: NotificationModule;
  readonly sendTemplateTest: SendTemplateTest;
}): ModuleRoute[] {
  const sdkRoutes = (createNotificationRoutes({ module: params.notification }) as readonly ModuleRoute[])
    .filter((route) => route.scope === ROUTE_SCOPE.ADMIN || route.scope === ROUTE_SCOPE.USER)
    .map(
      (route): ModuleRoute =>
        route.scope === ROUTE_SCOPE.ADMIN
          ? {
              ...route,
              requiredScopes: [route.method === 'GET' ? PANEL_SCOPES.READ : PANEL_SCOPES.NOTIFICATIONS_ADMIN],
            }
          : route,
    );

  return [
    ...sdkRoutes,
    {
      method: 'POST',
      path: '/notification-templates/:key/test',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.NOTIFICATIONS_ADMIN],
      operationId: 'sendPanelNotificationTemplateTest',
      summary: 'Envia o modelo aberto para a conta do app de quem esta logado (sem destinatario no corpo)',
      async handler(context) {
        const result = await params.sendTemplateTest({
          staffUserId: context.auth?.userId ?? '',
          templateKey: decodeURIComponent(context.params['key'] ?? ''),
        });
        // 202: o pedido entrou na fila; chegar ao aparelho e' outra etapa.
        return { kind: 'json', status: 202, body: { data: result } };
      },
    },
  ];
}

