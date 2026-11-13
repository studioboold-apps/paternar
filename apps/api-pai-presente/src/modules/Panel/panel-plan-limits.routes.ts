/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { ROUTE_SCOPE, type ModuleRoute } from '@adatechnology/module-http';

import { SPEND_WINDOW_MS } from '../PlanLimits/plan-limits.constant';
import { summarizeBudget } from '../PlanLimits/plan-limits.gate';
import type { PlanLimitsRepository } from '../PlanLimits/plan-limits.repository';
import { planLimitsBodySchema } from '../PlanLimits/plan-limits.schema';
import { PANEL_SCOPES } from './panel.constant';

const TOP_SPENDERS = 10;

class PlanLimitsBodyError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
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

export function buildPanelPlanLimitsRoutes(params: {
  readonly repository: PlanLimitsRepository;
  /** Receita aprovada em 30 dias, por moeda: so' para comparar no painel. */
  readonly revenue30d?: () => Promise<readonly { currency: string; cents: number; payments: number }[]>;
  /** Avisa o porteiro de que a configuracao mudou. */
  readonly onSaved?: () => void;
}): ModuleRoute[] {
  const { repository } = params;
  return [
    {
      method: 'GET',
      path: '/plan-limits',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelPlanLimits',
      summary: 'Chave e numeros dos limites do plano gratuito e do teto de IA',
      async handler() {
        return { kind: 'json', status: 200, body: { data: await repository.getSettings() } };
      },
    },
    {
      method: 'PUT',
      path: '/plan-limits',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.PLANS_ADMIN],
      operationId: 'updatePanelPlanLimits',
      summary: 'Liga ou desliga os limites e muda os numeros',
      async handler(context) {
        const body = planLimitsBodySchema.safeParse(readBody(context.rawBody));
        if (!body.success) throw new PlanLimitsBodyError('Valores invalidos.');
        const saved = await repository.saveSettings(body.data, context.auth?.userId ?? 'painel');
        params.onSaved?.();
        return { kind: 'json', status: 200, body: { data: saved } };
      },
    },
    {
      method: 'GET',
      path: '/plan-limits/spend',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelPlanSpend',
      summary: 'Gasto de IA dos assinantes em 30 dias: media, total frente ao orcamento e maiores consumidores',
      async handler() {
        const now = new Date();
        const since = new Date(now.getTime() - SPEND_WINDOW_MS);
        const [settings, pool, topSpenders, revenue] = await Promise.all([
          repository.getSettings(),
          repository.subscriberPoolSince(since, now),
          repository.topSubscriberSpenders({ since, limit: TOP_SPENDERS, now }),
          params.revenue30d ? params.revenue30d() : Promise.resolve([]),
        ]);
        const budget = summarizeBudget(settings, pool);
        return {
          kind: 'json',
          status: 200,
          body: {
            data: {
              days: SPEND_WINDOW_MS / (24 * 60 * 60 * 1000),
              ...budget,
              individualCapMicroUsd: settings.individualCapMicroUsd,
              warnAtPct: settings.warnAtPct,
              usdBrlRateCents: settings.usdBrlRateCents,
              revenue30d: revenue,
              topSpenders,
            },
          },
        };
      },
    },
  ];
}
