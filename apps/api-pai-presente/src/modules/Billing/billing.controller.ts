/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { AppError } from '../shared/errors/app.error';
import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_METHODS } from '../shared/http/http.constant';
import { respondWithData } from '../shared/http/response.util';
import type { PublicRouteDefinition, RouteDefinition } from '../shared/http/route.types';
import {
  BILLING_MINE_PATH,
  BILLING_PLANS_PATH,
  BILLING_WEBHOOK_MAX_BYTES,
  BILLING_WEBHOOK_PATH,
} from './billing.constant';
import type { BillingUseCases } from './billing.use-case';

function tooLarge(): AppError {
  return new AppError({ code: ERROR_CODES.billing.WEBHOOK_INVALID, message: 'Corpo grande demais.', statusCode: 413 });
}

export function buildBillingRoutes(useCases: BillingUseCases): readonly RouteDefinition[] {
  return [
    {
      method: HTTP_METHODS.GET,
      path: BILLING_MINE_PATH,
      summary: 'Plano e situacao da assinatura do pai, e o que ela libera.',
      handle: async ({ authenticatedUser }) => respondWithData(await useCases.getMine(authenticatedUser)),
    },
    {
      method: HTTP_METHODS.GET,
      path: BILLING_PLANS_PATH,
      summary: 'Planos disponiveis, com o link de checkout ja marcado para o pai.',
      handle: async ({ authenticatedUser }) => respondWithData(await useCases.listPlans(authenticatedUser)),
    },
  ];
}

/** O provedor chama sem sessao de pai: a credencial e' o segredo dele, conferido no SDK. */
export function buildBillingWebhookRoutes(useCases: BillingUseCases): readonly PublicRouteDefinition[] {
  return [
    {
      method: HTTP_METHODS.POST,
      path: BILLING_WEBHOOK_PATH,
      summary: 'Webhook do provedor de pagamento (Hotmart): compra, renovacao, cancelamento, reembolso.',
      handle: async ({ request, pathParams }) => {
        const declared = Number(request.headers.get('content-length') ?? 0);
        if (declared > BILLING_WEBHOOK_MAX_BYTES) throw tooLarge();
        const rawBody = await request.text();
        if (rawBody.length > BILLING_WEBHOOK_MAX_BYTES) throw tooLarge();
        const result = await useCases.receiveWebhook({
          provider: pathParams['provider'] ?? '',
          headers: request.headers,
          rawBody,
        });
        // 200 tambem no repetido: o provedor so para de reenviar quando recebe 2xx.
        return respondWithData({ received: true, duplicate: result.duplicate });
      },
    },
  ];
}
