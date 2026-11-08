/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Uso do app, alem dos cadastros. "Ativo" e' o pai que fez QUALQUER coisa no
 * periodo: entrou, criou ou concluiu atividade, conversou com o mentor, postou,
 * comentou ou avaliou um insight. Curtida nao conta (nao tem data).
 */

import { sql } from 'drizzle-orm';

import type { Database } from '../../database/client';

export type PanelEngagement = {
  readonly activeUsers1: number;
  readonly activeUsers7: number;
  readonly activeUsers30: number;
  /** Pais ativos por dia nos ultimos 30 dias, no fuso de Sao Paulo. */
  readonly activeByDay: readonly { readonly day: string; readonly total: number }[];
  readonly last30: {
    readonly activities: number;
    readonly activitiesCompleted: number;
    readonly chatMessages: number;
    readonly posts: number;
    readonly comments: number;
    readonly insightRatings: number;
  };
  /**
   * Dos que se cadastraram entre 14 e 60 dias atras, quantos voltaram depois
   * da primeira semana. E' a pergunta "o app segura o pai?".
   */
  readonly retention: { readonly cohort: number; readonly returned: number };
  /** Do cadastro ao uso: cada passo conta pais distintos. */
  readonly funnel: {
    readonly users: number;
    readonly onboarded: number;
    readonly withChild: number;
    readonly withActivity: number;
    readonly withChat: number;
    readonly withPost: number;
  };
  readonly openReports: number;
  readonly aiCalls30: number;
  readonly aiCost30MicroUsd: number;
};

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => result as Row[];
const num = (value: unknown): number => Number(value ?? 0);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Todo sinal de uso, um por linha: (pai, quando). */
const EVENTS = sql`
  select user_id, created_at as at from sessions
  union all select user_id, created_at from activities
  union all select user_id, updated_at from activities where is_completed
  union all select user_id, created_at from chat_messages where role = 'user'
  union all select author_id, created_at from community_posts
  union all select author_id, created_at from community_comments
  union all select user_id, created_at from insight_ratings
`;

export function createPanelEngagementRepository(database: Database) {
  return {
    async engagement(now: Date = new Date()): Promise<PanelEngagement> {
      const at = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
      const since1 = at(1);
      const since7 = at(7);
      const since30 = at(30);
      const since60 = at(60);
      const since14 = at(14);

      const [active, byDay, counts, retention, funnel, extras] = await Promise.all([
        database.execute(sql`
          with events as (${EVENTS})
          select count(distinct user_id) filter (where at >= ${since1})::int as d1,
                 count(distinct user_id) filter (where at >= ${since7})::int as d7,
                 count(distinct user_id) filter (where at >= ${since30})::int as d30
            from events where at >= ${since30}
        `),
        database.execute(sql`
          with events as (${EVENTS})
          select to_char(at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as day, count(distinct user_id)::int as total
            from events where at >= ${since30} group by 1 order by 1
        `),
        database.execute(sql`
          select
            (select count(*)::int from activities where created_at >= ${since30}) as activities,
            (select count(*)::int from activities where is_completed and updated_at >= ${since30}) as completed,
            (select count(*)::int from chat_messages where role = 'user' and created_at >= ${since30}) as chat,
            (select count(*)::int from community_posts where created_at >= ${since30}) as posts,
            (select count(*)::int from community_comments where created_at >= ${since30}) as comments,
            (select count(*)::int from insight_ratings where created_at >= ${since30}) as ratings
        `),
        database.execute(sql`
          with events as (${EVENTS}),
               cohort as (select id, created_at from users where created_at >= ${since60} and created_at < ${since14})
          select count(*)::int as cohort,
                 count(*) filter (where exists (
                   select 1 from events e where e.user_id = c.id and e.at >= c.created_at + interval '7 days'
                 ))::int as returned
            from cohort c
        `),
        database.execute(sql`
          select count(*)::int as users,
                 count(*) filter (where onboarding_completed)::int as onboarded,
                 count(*) filter (where exists (select 1 from children c where c.user_id = u.id))::int as with_child,
                 count(*) filter (where exists (select 1 from activities a where a.user_id = u.id))::int as with_activity,
                 count(*) filter (where exists (select 1 from chat_messages m where m.user_id = u.id and m.role = 'user'))::int as with_chat,
                 count(*) filter (where exists (select 1 from community_posts p where p.author_id = u.id))::int as with_post
            from users u
        `),
        database.execute(sql`
          select (select count(*)::int from community_reports where status = 'open') as open_reports,
                 (select count(*)::int from ai_usage where created_at >= ${since30}) as ai_calls,
                 (select coalesce(sum(cost_micro_usd), 0)::bigint from ai_usage where created_at >= ${since30}) as ai_cost
        `),
      ]);

      const [a] = rowsOf(active);
      const [c] = rowsOf(counts);
      const [r] = rowsOf(retention);
      const [f] = rowsOf(funnel);
      const [x] = rowsOf(extras);
      return {
        activeUsers1: num(a?.d1),
        activeUsers7: num(a?.d7),
        activeUsers30: num(a?.d30),
        activeByDay: rowsOf(byDay).map((row) => ({ day: String(row.day), total: num(row.total) })),
        last30: {
          activities: num(c?.activities),
          activitiesCompleted: num(c?.completed),
          chatMessages: num(c?.chat),
          posts: num(c?.posts),
          comments: num(c?.comments),
          insightRatings: num(c?.ratings),
        },
        retention: { cohort: num(r?.cohort), returned: num(r?.returned) },
        funnel: {
          users: num(f?.users),
          onboarded: num(f?.onboarded),
          withChild: num(f?.with_child),
          withActivity: num(f?.with_activity),
          withChat: num(f?.with_chat),
          withPost: num(f?.with_post),
        },
        openReports: num(x?.open_reports),
        aiCalls30: num(x?.ai_calls),
        aiCost30MicroUsd: num(x?.ai_cost),
      };
    },
  };
}

export type PanelEngagementRepository = ReturnType<typeof createPanelEngagementRepository>;
