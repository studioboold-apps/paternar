/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { z } from 'zod';

import { MICRO_USD_PER_USD } from './plan-limits.constant';

const whole = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum);

/** O que o painel manda. Os tetos evitam um zero a mais digitado por engano. */
export const planLimitsBodySchema = z.object({
  enabled: z.boolean(),
  freeChatMessagesPerWeek: whole(0, 1000),
  freeMaxChildren: whole(1, 20),
  subscriberRevenueCentsBrl: whole(0, 100_000),
  aiShareOfRevenuePct: whole(0, 100),
  usdBrlRateCents: whole(100, 5_000),
  individualCapMicroUsd: whole(0, 1000 * MICRO_USD_PER_USD),
  warnAtPct: whole(10, 100),
});

export type PlanLimitsBody = z.infer<typeof planLimitsBodySchema>;
