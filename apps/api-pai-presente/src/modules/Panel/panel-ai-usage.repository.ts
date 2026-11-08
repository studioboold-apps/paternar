/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Quanto a IA custa: soma da tabela `ai_usage`, que guarda os tokens que o
 * provedor contou em cada chamada. Valores em milionesimos de dolar.
 */

import { sql } from 'drizzle-orm';

import type { Database } from '../../database/client';

export type PanelAiUsage = {
  readonly days: number;
  readonly totals: {
    readonly calls: number;
    readonly costMicroUsd: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly webSearches: number;
    readonly users: number;
  };
  /** Mes corrente (fuso de Sao Paulo), para comparar com a fatura. */
  readonly monthToDateMicroUsd: number;
  readonly byDay: readonly { readonly day: string; readonly calls: number; readonly costMicroUsd: number }[];
  readonly byTask: readonly { readonly task: string; readonly calls: number; readonly costMicroUsd: number }[];
  readonly byModel: readonly { readonly model: string; readonly calls: number; readonly costMicroUsd: number }[];
  readonly topUsers: readonly {
    readonly id: string;
    readonly name: string | null;
    readonly email: string;
    readonly calls: number;
    readonly costMicroUsd: number;
  }[];
};

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => result as Row[];
const num = (value: unknown): number => Number(value ?? 0);

export function createPanelAiUsageRepository(database: Database) {
  return {
    async summary(params: { readonly days: number; readonly now?: Date }): Promise<PanelAiUsage> {
      const now = params.now ?? new Date();
      const since = new Date(now.getTime() - params.days * 24 * 60 * 60 * 1000).toISOString();
      const day = sql`to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;

      const [totals, month, byDay, byTask, byModel, topUsers] = await Promise.all([
        database.execute(sql`
          select count(*)::int as calls, coalesce(sum(cost_micro_usd), 0)::bigint as cost,
                 coalesce(sum(input_tokens), 0)::bigint as input, coalesce(sum(output_tokens), 0)::bigint as output,
                 coalesce(sum(cache_read_tokens), 0)::bigint as cache_read, coalesce(sum(web_searches), 0)::int as searches,
                 count(distinct user_id)::int as users
            from ai_usage where created_at >= ${since}
        `),
        database.execute(sql`
          select coalesce(sum(cost_micro_usd), 0)::bigint as cost from ai_usage
           where created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
        `),
        database.execute(sql`
          select ${day} as day, count(*)::int as calls, coalesce(sum(cost_micro_usd), 0)::bigint as cost
            from ai_usage where created_at >= ${since} group by 1 order by 1
        `),
        database.execute(sql`
          select task, count(*)::int as calls, coalesce(sum(cost_micro_usd), 0)::bigint as cost
            from ai_usage where created_at >= ${since} group by task order by cost desc
        `),
        database.execute(sql`
          select model, count(*)::int as calls, coalesce(sum(cost_micro_usd), 0)::bigint as cost
            from ai_usage where created_at >= ${since} group by model order by cost desc
        `),
        database.execute(sql`
          select u.id, u.full_name, u.email, count(*)::int as calls, coalesce(sum(a.cost_micro_usd), 0)::bigint as cost
            from ai_usage a join users u on u.id = a.user_id
           where a.created_at >= ${since}
           group by u.id, u.full_name, u.email
           order by cost desc, calls desc
           limit 10
        `),
      ]);

      const [total] = rowsOf(totals);
      return {
        days: params.days,
        totals: {
          calls: num(total?.calls),
          costMicroUsd: num(total?.cost),
          inputTokens: num(total?.input),
          outputTokens: num(total?.output),
          cacheReadTokens: num(total?.cache_read),
          webSearches: num(total?.searches),
          users: num(total?.users),
        },
        monthToDateMicroUsd: num(rowsOf(month)[0]?.cost),
        byDay: rowsOf(byDay).map((row) => ({ day: String(row.day), calls: num(row.calls), costMicroUsd: num(row.cost) })),
        byTask: rowsOf(byTask).map((row) => ({ task: String(row.task), calls: num(row.calls), costMicroUsd: num(row.cost) })),
        byModel: rowsOf(byModel).map((row) => ({ model: String(row.model), calls: num(row.calls), costMicroUsd: num(row.cost) })),
        topUsers: rowsOf(topUsers).map((row) => ({
          id: String(row.id),
          name: (row.full_name as string | null) ?? null,
          email: String(row.email),
          calls: num(row.calls),
          costMicroUsd: num(row.cost),
        })),
      };
    },
  };
}

export type PanelAiUsageRepository = ReturnType<typeof createPanelAiUsageRepository>;
