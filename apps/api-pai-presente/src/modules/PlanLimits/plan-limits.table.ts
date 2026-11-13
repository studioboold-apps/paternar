/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { boolean, integer, pgTable, smallint, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SHORT_TEXT_LENGTH } from '../shared/shared.constant';
import { DEFAULT_PLAN_LIMITS, PLAN_LIMITS_ROW_ID } from './plan-limits.constant';

/** Uma linha so' (`id = 1`): a configuracao vigente, editada no painel. */
export const planLimitsTable = pgTable('plan_limits', {
  id: smallint('id').primaryKey().default(PLAN_LIMITS_ROW_ID),
  enabled: boolean('enabled').notNull().default(DEFAULT_PLAN_LIMITS.enabled),
  freeChatMessagesPerWeek: integer('free_chat_messages_per_week')
    .notNull()
    .default(DEFAULT_PLAN_LIMITS.freeChatMessagesPerWeek),
  freeMaxChildren: integer('free_max_children').notNull().default(DEFAULT_PLAN_LIMITS.freeMaxChildren),
  subscriberRevenueCentsBrl: integer('subscriber_revenue_cents_brl')
    .notNull()
    .default(DEFAULT_PLAN_LIMITS.subscriberRevenueCentsBrl),
  aiShareOfRevenuePct: integer('ai_share_of_revenue_pct').notNull().default(DEFAULT_PLAN_LIMITS.aiShareOfRevenuePct),
  usdBrlRateCents: integer('usd_brl_rate_cents').notNull().default(DEFAULT_PLAN_LIMITS.usdBrlRateCents),
  individualCapMicroUsd: integer('individual_cap_micro_usd')
    .notNull()
    .default(DEFAULT_PLAN_LIMITS.individualCapMicroUsd),
  warnAtPct: integer('warn_at_pct').notNull().default(DEFAULT_PLAN_LIMITS.warnAtPct),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** E-mail de quem mudou por ultimo no painel. */
  updatedBy: varchar('updated_by', { length: SHORT_TEXT_LENGTH }),
});

export type PlanLimitsRow = typeof planLimitsTable.$inferSelect;
