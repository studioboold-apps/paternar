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

import { z } from 'zod';

import type { SendTemplateTest } from '../Notification/template-test';
import type { Logger } from '../shared/logger/logger';
import { PANEL_SCOPES } from './panel.constant';

/** Corpo opcional: sem `recipientUserId`, o teste vai para quem esta logado. */
const testBodySchema = z
  .object({ recipientUserId: z.string().uuid().optional() })
  .strict();

class TemplateTestBodyError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

class TemplateTestForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

/** Sem `bodySchema` (o module-http e' zod 3, o app zod 4): le dos bytes crus. */
function readBody(rawBody: Uint8Array | undefined): unknown {
  if (!rawBody || rawBody.length === 0) return {};
  try {
    return JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return undefined;
  }
}

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
  readonly logger?: Logger | undefined;
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
      summary: 'Envia o modelo aberto para quem esta logado ou, se admin, para um pai escolhido',
      async handler(context) {
        const body = testBodySchema.safeParse(readBody(context.rawBody));
        if (!body.success) throw new TemplateTestBodyError('Destinatario invalido.');
        const recipientUserId = body.data.recipientUserId;
        if (recipientUserId && !context.auth?.scopes.includes(PANEL_SCOPES.NOTIFICATIONS_SEND_ANY)) {
          throw new TemplateTestForbiddenError('So admin envia teste para outro pai.');
        }

        const staffUserId = context.auth?.userId ?? '';
        const result = await params.sendTemplateTest({
          staffUserId,
          templateKey: decodeURIComponent(context.params['key'] ?? ''),
          recipientUserId,
        });
        if (recipientUserId) {
          // Fica no log quem da equipe mandou push para qual pai.
          params.logger?.info('painel: teste de notificacao enviado a um pai escolhido', {
            staffUserId,
            recipientUserId,
            templateKey: result.templateKey,
          });
        }
        // 202: o pedido entrou na fila; chegar ao aparelho e' outra etapa.
        return { kind: 'json', status: 202, body: { data: result } };
      },
    },
  ];
}

