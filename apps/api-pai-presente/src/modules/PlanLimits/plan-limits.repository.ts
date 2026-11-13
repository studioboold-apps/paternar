/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { and, count, eq, gte, min, sql, sum } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { aiUsageTable } from '../AiUsage/ai-usage.table';
import { childrenTable } from '../Child/child.table';
import { DEFAULT_PLAN_LIMITS, PAST_DUE_GRACE_MS, PLAN_LIMITS_ROW_ID, type PlanLimitsSettings } from './plan-limits.constant';
import type { SubscriberPool } from './plan-limits.gate';
import { planLimitsTable, type PlanLimitsRow } from './plan-limits.table';

export type PlanLimitsConfig = PlanLimitsSettings & {
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
};

export type SubscriberSpender = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly costMicroUsd: number;
  readonly calls: number;
};

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => result as Row[];
const num = (value: unknown): number => Number(value ?? 0);

function toSettings(row: PlanLimitsRow | undefined): PlanLimitsConfig {
  if (row === undefined) return { ...DEFAULT_PLAN_LIMITS, updatedAt: null, updatedBy: null };
  const { id: _id, updatedAt, updatedBy, ...settings } = row;
  return { ...settings, updatedAt: updatedAt.toISOString(), updatedBy };
}

/**
 * Quem tem acesso agora, na mesma regra do `payment-module`: ativo; atrasado
 * dentro da tolerancia; ou cancelado com periodo pago ainda correndo.
 */
function subscribersWithAccess(now: Date) {
  const graceLimit = new Date(now.getTime() - PAST_DUE_GRACE_MS).toISOString();
  const nowIso = now.toISOString();
  return sql`
    select distinct s.customer_ref as user_ref
      from payment.subscriptions s
     where s.customer_ref is not null
       and (s.status = 'active'
            or (s.status = 'past_due' and (s.period_ends_at is null or s.period_ends_at > ${graceLimit}))
            or (s.status = 'canceled' and s.period_ends_at > ${nowIso}))
  `;
}

export function createPlanLimitsRepository(database: Database) {
  return {
    async getSettings(): Promise<PlanLimitsConfig> {
      const rows = await database.select().from(planLimitsTable).where(eq(planLimitsTable.id, PLAN_LIMITS_ROW_ID));
      return toSettings(rows[0]);
    },

    async saveSettings(settings: PlanLimitsSettings, updatedBy: string): Promise<PlanLimitsConfig> {
      const values = { ...settings, updatedBy, updatedAt: new Date() };
      const rows = await database
        .insert(planLimitsTable)
        .values({ id: PLAN_LIMITS_ROW_ID, ...values })
        .onConflictDoUpdate({ target: planLimitsTable.id, set: values })
        .returning();
      return toSettings(rows[0]);
    },

    async chatCallsSince({ userId, since }: { readonly userId: string; readonly since: Date }) {
      const rows = await database
        .select({ value: count(), oldest: min(aiUsageTable.createdAt) })
        .from(aiUsageTable)
        .where(and(eq(aiUsageTable.userId, userId), eq(aiUsageTable.task, 'chat'), gte(aiUsageTable.createdAt, since)));
      const row = rows[0];
      return { count: row?.value ?? 0, oldest: row?.oldest ?? undefined };
    },

    async userSpendSince({ userId, since }: { readonly userId: string; readonly since: Date }): Promise<number> {
      const rows = await database
        .select({ value: sum(aiUsageTable.costMicroUsd) })
        .from(aiUsageTable)
        .where(and(eq(aiUsageTable.userId, userId), gte(aiUsageTable.createdAt, since)));
      return num(rows[0]?.value);
    },

    async subscriberPoolSince(since: Date, now: Date = new Date()): Promise<SubscriberPool> {
      const result = rowsOf(
        await database.execute(sql`
          with subs as (${subscribersWithAccess(now)})
          select (select count(*) from subs)::int as subscribers,
                 coalesce((select sum(u.cost_micro_usd) from ai_usage u
                            join subs on subs.user_ref = u.user_id::text
                           where u.created_at >= ${since.toISOString()}), 0)::bigint as spent
        `),
      );
      return { subscribers: num(result[0]?.subscribers), spentMicroUsd: num(result[0]?.spent) };
    },

    async topSubscriberSpenders(params: {
      readonly since: Date;
      readonly limit: number;
      readonly now?: Date;
    }): Promise<SubscriberSpender[]> {
      const result = rowsOf(
        await database.execute(sql`
          with subs as (${subscribersWithAccess(params.now ?? new Date())})
          select us.id, us.full_name as name, us.email,
                 coalesce(sum(u.cost_micro_usd), 0)::bigint as cost, count(*)::int as calls
            from ai_usage u
            join subs on subs.user_ref = u.user_id::text
            join users us on us.id = u.user_id
           where u.created_at >= ${params.since.toISOString()}
           group by us.id, us.full_name, us.email
           order by cost desc
           limit ${params.limit}
        `),
      );
      return result.map((row) => ({
        id: String(row.id),
        name: (row.name as string | null) ?? null,
        email: String(row.email),
        costMicroUsd: num(row.cost),
        calls: num(row.calls),
      }));
    },

    async countChildren(userId: string): Promise<number> {
      const rows = await database.select({ value: count() }).from(childrenTable).where(eq(childrenTable.userId, userId));
      return rows[0]?.value ?? 0;
    },
  };
}

export type PlanLimitsRepository = ReturnType<typeof createPlanLimitsRepository>;
