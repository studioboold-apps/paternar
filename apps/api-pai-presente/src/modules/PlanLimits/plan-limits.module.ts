/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { Database } from '../../database/client';
import { HTTP_METHODS } from '../shared/http/http.constant';
import { respondWithData } from '../shared/http/response.util';
import type { RouteDefinition } from '../shared/http/route.types';
import { PLAN_STATUS_PATH } from './plan-limits.constant';
import { createPlanGate, type PlanGate } from './plan-limits.gate';
import { createPlanLimitsRepository } from './plan-limits.repository';

/**
 * `isSubscriber` vem de fora (o modulo de pagamentos): o porteiro so' sabe
 * contar e comparar, nao de onde sai a assinatura.
 */
export function buildPlanGate(params: {
  readonly database: Database;
  readonly isSubscriber: (userId: string) => Promise<boolean>;
}): PlanGate {
  const repository = createPlanLimitsRepository(params.database);
  return createPlanGate({
    settings: () => repository.getSettings(),
    isSubscriber: params.isSubscriber,
    chatCallsSince: (query) => repository.chatCallsSince(query),
    userSpendSince: (query) => repository.userSpendSince(query),
    subscriberPoolSince: (since) => repository.subscriberPoolSince(since),
    countChildren: (userId) => repository.countChildren(userId),
  });
}

/** O app pergunta antes de mostrar o contador de conversas e o cadeado da foto. */
export function buildPlanStatusRoutes(gate: PlanGate): readonly RouteDefinition[] {
  return [
    {
      method: HTTP_METHODS.GET,
      path: PLAN_STATUS_PATH,
      summary: 'O que o plano do pai libera agora e quanto ja usou.',
      handle: async ({ authenticatedUser }) => respondWithData(await gate.status(authenticatedUser.userId)),
    },
  ];
}
