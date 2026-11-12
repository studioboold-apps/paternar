/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A ficha de um pai no painel: numeros e linha do tempo. A regra de privacidade
 * do painel continua valendo (LGPD art. 6, III): entram DATAS e CONTAGENS, e
 * nunca o texto da conversa com o mentor, foto, exame, valores da familia ou
 * dado de filho alem de "cadastrou um filho". Post e comentario aparecem em
 * trecho porque ja sao publicos para a comunidade inteira.
 */

import { sql } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { AUDIT_ACTIONS, type AuditTargetType } from '../Audit/audit.constant';
import { recordAuditEntry } from '../Audit/audit.repository';

/** Quantos eventos a linha do tempo traz de uma vez. */
export const TIMELINE_LIMIT = 120;
const EXCERPT_LENGTH = 140;

export type TimelineEvent = {
  readonly at: string;
  /** signup | login | child | activity | activity_done | post | comment | chat | ai | insight | report_made | report_received | audit */
  readonly kind: string;
  /** Categoria, trecho publico, motivo ou acao de LGPD. Nunca conversa privada. */
  readonly detail: string | null;
  /** Para eventos agrupados por dia (conversa, IA): quantos. */
  readonly count: number;
};

export type PanelUserDetail = {
  readonly profile: {
    readonly id: string;
    readonly email: string;
    readonly fullName: string | null;
    readonly city: string | null;
    readonly onboardingCompleted: boolean;
    readonly createdAt: string;
    readonly blockedAt: string | null;
  };
  readonly stats: {
    readonly children: number;
    readonly activities: number;
    readonly activitiesCompleted: number;
    readonly posts: number;
    readonly comments: number;
    readonly likesGiven: number;
    readonly chatMessages: number;
    readonly insightRatings: number;
    readonly logins: number;
    readonly reportsReceived: number;
    readonly reportsReceivedOpen: number;
    readonly reportsMade: number;
    readonly aiCalls: number;
    readonly aiCostMicroUsd: number;
    readonly aiCalls30: number;
    readonly aiCost30MicroUsd: number;
  };
  readonly lastLoginAt: string | null;
  readonly lastActivityAt: string | null;
  readonly timeline: readonly TimelineEvent[];
  /** Quem da equipe abriu esta ficha por ultimo (trilha do art. 37). */
  readonly teamViews: readonly { readonly at: string; readonly actorEmail: string | null }[];
};

export type TeamAccessRow = {
  readonly at: string;
  readonly action: string;
  readonly actorEmail: string | null;
  readonly actorName: string | null;
  readonly targetId: string;
  readonly targetName: string | null;
  readonly targetEmail: string | null;
};

type Row = Record<string, unknown>;

function rowsOf(result: unknown): Row[] {
  return result as Row[];
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

const num = (value: unknown): number => Number(value ?? 0);

/** O painel guarda o rastro com o id do acesso da equipe e o ip de quem olhou. */
export const PANEL_AUDIT_ACTIONS = [
  AUDIT_ACTIONS.PANEL_USER_VIEWED,
  AUDIT_ACTIONS.PANEL_CONTENT_REMOVED,
  AUDIT_ACTIONS.PANEL_REPORT_DISMISSED,
] as const;

export function createPanelHistoryRepository(database: Database) {
  return {
    async recordPanelAction(entry: {
      readonly actorId: string;
      readonly action: (typeof PANEL_AUDIT_ACTIONS)[number];
      readonly targetType: AuditTargetType;
      readonly targetId: string;
      readonly clientIp: string;
    }): Promise<void> {
      await recordAuditEntry({ executor: database, entry });
    },

    async userDetail(userId: string, now: Date = new Date()): Promise<PanelUserDetail | undefined> {
      const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [profile] = rowsOf(
        await database.execute(sql`
          select u.id, u.email, u.full_name, u.city, u.onboarding_completed, u.created_at,
                 u.blocked_at
            from users u where u.id = ${userId}
        `),
      );
      if (profile === undefined) return undefined;

      const [stats] = rowsOf(
        await database.execute(sql`
          select
            (select count(*)::int from children where user_id = ${userId}) as children,
            (select count(*)::int from activities where user_id = ${userId}) as activities,
            (select count(*)::int from activities where user_id = ${userId} and is_completed) as activities_completed,
            (select count(*)::int from community_posts where author_id = ${userId}) as posts,
            (select count(*)::int from community_comments where author_id = ${userId}) as comments,
            (select count(*)::int from community_post_likes where user_id = ${userId}) as likes_given,
            (select count(*)::int from chat_messages where user_id = ${userId} and role = 'user') as chat_messages,
            (select count(*)::int from insight_ratings where user_id = ${userId}) as insight_ratings,
            (select count(*)::int from sessions where user_id = ${userId}) as logins,
            (select max(created_at) from sessions where user_id = ${userId}) as last_login_at,
            (select count(*)::int from community_reports where reported_user_id = ${userId}) as reports_received,
            (select count(*)::int from community_reports where reported_user_id = ${userId} and status = 'open') as reports_received_open,
            (select count(*)::int from community_reports where reporter_id = ${userId}) as reports_made,
            (select count(*)::int from ai_usage where user_id = ${userId}) as ai_calls,
            (select coalesce(sum(cost_micro_usd), 0)::bigint from ai_usage where user_id = ${userId}) as ai_cost,
            (select count(*)::int from ai_usage where user_id = ${userId} and created_at >= ${since30}) as ai_calls_30,
            (select coalesce(sum(cost_micro_usd), 0)::bigint from ai_usage where user_id = ${userId} and created_at >= ${since30}) as ai_cost_30
        `),
      );

      const timeline = rowsOf(
        await database.execute(sql`
          select at, kind, detail, count from (
            select created_at as at, 'signup' as kind, null::text as detail, 1 as count from users where id = ${userId}
            union all
            select created_at, 'login', null, 1 from sessions where user_id = ${userId}
            union all
            select created_at, 'child', null, 1 from children where user_id = ${userId}
            union all
            select created_at, 'activity', category, 1 from activities where user_id = ${userId}
            union all
            select updated_at, 'activity_done', category, 1 from activities where user_id = ${userId} and is_completed
            union all
            select created_at, 'post', left(content, ${EXCERPT_LENGTH}), 1 from community_posts where author_id = ${userId}
            union all
            select created_at, 'comment', left(content, ${EXCERPT_LENGTH}), 1 from community_comments where author_id = ${userId}
            union all
            select max(created_at), 'chat', null, count(*)::int from chat_messages
             where user_id = ${userId} and role = 'user'
             group by (created_at at time zone 'America/Sao_Paulo')::date
            union all
            select max(created_at), 'ai', task, count(*)::int from ai_usage
             where user_id = ${userId}
             group by (created_at at time zone 'America/Sao_Paulo')::date, task
            union all
            select created_at, 'insight', category, 1 from insight_ratings where user_id = ${userId}
            union all
            select created_at, 'report_made', reason, 1 from community_reports where reporter_id = ${userId}
            union all
            select created_at, 'report_received', reason, 1 from community_reports where reported_user_id = ${userId}
            union all
            select created_at, 'audit', action, 1 from audit_log
             where actor_id = ${userId} and action not like 'panel_%'
          ) events
          where at is not null
          order by at desc
          limit ${TIMELINE_LIMIT}
        `),
      );

      const teamViews = rowsOf(
        await database.execute(sql`
          select a.created_at as at, pu.email as actor_email
            from audit_log a
            left join "user"."users" pu on pu.id = a.actor_id
           where a.target_id = ${userId} and a.action = ${AUDIT_ACTIONS.PANEL_USER_VIEWED}
           order by a.created_at desc
           limit 10
        `),
      );

      const events: TimelineEvent[] = timeline.map((row) => ({
        at: iso(row.at) ?? '',
        kind: String(row.kind),
        detail: row.detail === null || row.detail === undefined ? null : String(row.detail),
        count: num(row.count),
      }));
      const lastActivityAt = events.find((event) => event.kind !== 'signup' && event.kind !== 'report_received')?.at ?? null;

      return {
        profile: {
          id: String(profile.id),
          email: String(profile.email),
          fullName: (profile.full_name as string | null) ?? null,
          city: (profile.city as string | null) ?? null,
          onboardingCompleted: Boolean(profile.onboarding_completed),
          createdAt: iso(profile.created_at) ?? '',
          blockedAt: iso(profile.blocked_at),
        },
        stats: {
          children: num(stats?.children),
          activities: num(stats?.activities),
          activitiesCompleted: num(stats?.activities_completed),
          posts: num(stats?.posts),
          comments: num(stats?.comments),
          likesGiven: num(stats?.likes_given),
          chatMessages: num(stats?.chat_messages),
          insightRatings: num(stats?.insight_ratings),
          logins: num(stats?.logins),
          reportsReceived: num(stats?.reports_received),
          reportsReceivedOpen: num(stats?.reports_received_open),
          reportsMade: num(stats?.reports_made),
          aiCalls: num(stats?.ai_calls),
          aiCostMicroUsd: num(stats?.ai_cost),
          aiCalls30: num(stats?.ai_calls_30),
          aiCost30MicroUsd: num(stats?.ai_cost_30),
        },
        lastLoginAt: iso(stats?.last_login_at),
        lastActivityAt,
        timeline: events,
        teamViews: teamViews.map((row) => ({ at: iso(row.at) ?? '', actorEmail: (row.actor_email as string | null) ?? null })),
      };
    },

    /** Trilha do painel: quem da equipe viu ou mexeu em quem, do mais novo ao mais antigo. */
    async listTeamAccess(params: { readonly page: number; readonly perPage: number }): Promise<{
      rows: TeamAccessRow[];
      total: number;
    }> {
      const offset = (params.page - 1) * params.perPage;
      const [rows, [counted]] = await Promise.all([
        database.execute(sql`
          select a.created_at as at, a.action, a.target_id,
                 pu.email as actor_email, pu.name as actor_name,
                 coalesce(u.full_name, ru.full_name) as target_name,
                 coalesce(u.email, ru.email) as target_email
            from audit_log a
            left join "user"."users" pu on pu.id = a.actor_id
            left join users u on u.id = a.target_id
            left join community_reports r on r.id = a.target_id
            left join users ru on ru.id = r.reported_user_id
           where a.action like 'panel_%'
           order by a.created_at desc
           limit ${params.perPage} offset ${offset}
        `),
        database.execute(sql`select count(*)::int as total from audit_log where action like 'panel_%'`),
      ]).then(([list, total]) => [rowsOf(list), rowsOf(total)] as const);

      return {
        rows: rows.map((row) => ({
          at: iso(row.at) ?? '',
          action: String(row.action),
          actorEmail: (row.actor_email as string | null) ?? null,
          actorName: (row.actor_name as string | null) ?? null,
          targetId: String(row.target_id),
          targetName: (row.target_name as string | null) ?? null,
          targetEmail: (row.target_email as string | null) ?? null,
        })),
        total: num(counted?.total),
      };
    },
  };
}

export type PanelHistoryRepository = ReturnType<typeof createPanelHistoryRepository>;
