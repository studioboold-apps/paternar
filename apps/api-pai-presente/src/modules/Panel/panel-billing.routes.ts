/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { ROUTE_SCOPE, type ModuleRoute } from '@adatechnology/module-http';
import { z } from 'zod';

import { SUBSCRIPTION_STATUS_VALUES } from '../../sdk/payments';
import type { PanelBillingRepository } from './panel-billing.repository';
import { PANEL_SCOPES } from './panel.constant';

class PanelBillingQueryError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

const pageShape = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
};
const subscriptionsQuerySchema = z.object({
  ...pageShape,
  status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
const eventsQuerySchema = z.object(pageShape);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PanelBillingQueryError('Parametros invalidos.');
  return parsed.data;
}

export function buildPanelBillingRoutes(
  repository: Pick<PanelBillingRepository, 'overview' | 'listSubscriptions' | 'listEvents'>,
): ModuleRoute[] {
  return [
    {
      method: 'GET',
      path: '/billing/overview',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelBillingOverview',
      summary: 'Assinaturas por situacao e plano, e receita aprovada em 30 dias',
      async handler() {
        return { kind: 'json', status: 200, body: { data: await repository.overview() } };
      },
    },
    {
      method: 'GET',
      path: '/billing/subscriptions',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'listPanelSubscriptions',
      summary: 'Assinantes, com filtro por situacao e busca por nome ou e-mail',
      async handler(context) {
        const query = parse(subscriptionsQuerySchema, context.query);
        const { rows, total } = await repository.listSubscriptions(query);
        return {
          kind: 'json',
          status: 200,
          body: { data: rows, pagination: { total, page: query.page, perPage: query.perPage } },
        };
      },
    },
    {
      method: 'GET',
      path: '/billing/events',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'listPanelPaymentEvents',
      summary: 'Ultimos webhooks de pagamento recebidos do provedor',
      async handler(context) {
        const query = parse(eventsQuerySchema, context.query);
        const { rows, total } = await repository.listEvents(query);
        return { kind: 'json', status: 200, body: { data: rows, pagination: { total, ...query } } };
      },
    },
  ];
}
