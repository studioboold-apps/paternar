/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A fila de denuncias da comunidade. A equipe decide uma vez por CONTEUDO:
 * arquivar ou remover vale para todas as denuncias abertas do mesmo post ou
 * comentario, porque cinco pais denunciando a mesma coisa e' um caso so'.
 */

import { sql } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { REPORT_STATUSES, type ReportStatus } from '../CommunityReport/community-report.constant';

export type PanelReportRow = {
  readonly id: string;
  readonly createdAt: string;
  readonly status: string;
  readonly targetType: string;
  readonly postId: string | null;
  readonly commentId: string | null;
  readonly contentSnapshot: string;
  /** O conteudo ainda esta no ar? Falso depois de removido (pela equipe ou pelo autor). */
  readonly contentOnline: boolean;
  readonly reason: string;
  readonly details: string | null;
  readonly reporter: { readonly id: string; readonly name: string | null; readonly email: string };
  readonly author: {
    readonly id: string;
    readonly name: string | null;
    readonly email: string;
    readonly blockedAt: string | null;
    /** Denuncias que este autor ja' recebeu, em todos os conteudos. */
    readonly reportsReceived: number;
  };
  /** Denuncias abertas sobre o MESMO conteudo (inclui esta). */
  readonly openOnSameContent: number;
  readonly resolvedAt: string | null;
  readonly resolvedByEmail: string | null;
};

export type ResolveReportAction = 'dismiss' | 'remove';

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => result as Row[];
const iso = (value: unknown): string | null =>
  value === null || value === undefined ? null : new Date(value as string).toISOString();

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value);
}

/** Mesma denuncia = mesmo tipo e mesmo alvo (o comentario, ou o post quando o alvo e' o post). */
const SAME_TARGET = sql`
  o.target_type = r.target_type
  and o.post_id is not distinct from r.post_id
  and o.comment_id is not distinct from r.comment_id
`;

export function createPanelModerationRepository(database: Database) {
  return {
    async listReports(params: {
      readonly status: ReportStatus;
      readonly page: number;
      readonly perPage: number;
    }): Promise<{ rows: PanelReportRow[]; total: number }> {
      const offset = (params.page - 1) * params.perPage;
      const [list, counted] = await Promise.all([
        database.execute(sql`
          select r.id, r.created_at, r.status, r.target_type, r.post_id, r.comment_id,
                 r.content_snapshot, r.reason, r.details, r.resolved_at,
                 (case when r.target_type = 'post' then r.post_id is not null else r.comment_id is not null end) as content_online,
                 rep.id as reporter_id, rep.full_name as reporter_name, rep.email as reporter_email,
                 au.id as author_id, au.full_name as author_name, au.email as author_email,
                 au.blocked_at as author_blocked_at,
                 (select count(*)::int from community_reports x where x.reported_user_id = au.id) as author_reports,
                 (select count(*)::int from community_reports o where o.status = 'open' and ${SAME_TARGET}) as open_same,
                 pu.email as resolved_by_email
            from community_reports r
            join users rep on rep.id = r.reporter_id
            join users au on au.id = r.reported_user_id
            left join "user"."users" pu on pu.id = r.resolved_by
           where r.status = ${params.status}
           order by r.created_at desc
           limit ${params.perPage} offset ${offset}
        `),
        database.execute(sql`select count(*)::int as total from community_reports where status = ${params.status}`),
      ]);

      return {
        rows: rowsOf(list).map((row) => ({
          id: String(row.id),
          createdAt: iso(row.created_at) ?? '',
          status: String(row.status),
          targetType: String(row.target_type),
          postId: (row.post_id as string | null) ?? null,
          commentId: (row.comment_id as string | null) ?? null,
          contentSnapshot: String(row.content_snapshot),
          contentOnline: Boolean(row.content_online),
          reason: String(row.reason),
          details: (row.details as string | null) ?? null,
          reporter: {
            id: String(row.reporter_id),
            name: (row.reporter_name as string | null) ?? null,
            email: String(row.reporter_email),
          },
          author: {
            id: String(row.author_id),
            name: (row.author_name as string | null) ?? null,
            email: String(row.author_email),
            blockedAt: iso(row.author_blocked_at),
            reportsReceived: Number(row.author_reports ?? 0),
          },
          openOnSameContent: Number(row.open_same ?? 0),
          resolvedAt: iso(row.resolved_at),
          resolvedByEmail: (row.resolved_by_email as string | null) ?? null,
        })),
        total: Number(rowsOf(counted)[0]?.total ?? 0),
      };
    },

    async countOpenReports(): Promise<number> {
      const [row] = rowsOf(await database.execute(sql`select count(*)::int as total from community_reports where status = 'open'`));
      return Number(row?.total ?? 0);
    },

    /**
     * Arquiva ou remove. Remover apaga o post (com comentarios e curtidas, pela
     * cascata) ou o comentario; a denuncia fica, com a copia do texto. Devolve
     * quantas denuncias foram fechadas, ou `undefined` se a denuncia nao existe.
     */
    async resolveReport(params: {
      readonly reportId: string;
      readonly action: ResolveReportAction;
      readonly resolvedBy: string;
    }): Promise<{ readonly closed: number; readonly removedContent: boolean } | undefined> {
      return database.transaction(async (tx) => {
        const [report] = rowsOf(
          await tx.execute(sql`
            select id, target_type, post_id, comment_id from community_reports where id = ${params.reportId} for update
          `),
        );
        if (report === undefined) return undefined;

        const status: ReportStatus = params.action === 'remove' ? 'removed' : 'dismissed';
        // Fecha primeiro: depois do delete, o vinculo vira nulo e a busca por alvo nao acha mais nada.
        const closed = rowsOf(
          await tx.execute(sql`
            update community_reports o
               set status = ${status}, resolved_at = now(), resolved_by = ${params.resolvedBy}, updated_at = now()
              from community_reports r
             where r.id = ${params.reportId}
               and (o.id = r.id or (o.status = 'open' and ${SAME_TARGET}))
            returning o.id
          `),
        ).length;

        let removedContent = false;
        if (params.action === 'remove') {
          const deleted =
            report.target_type === 'post'
              ? await tx.execute(sql`delete from community_posts where id = ${report.post_id} returning id`)
              : await tx.execute(sql`delete from community_comments where id = ${report.comment_id} returning id`);
          removedContent = rowsOf(deleted).length > 0;
        }
        return { closed, removedContent };
      });
    },
  };
}

export type PanelModerationRepository = ReturnType<typeof createPanelModerationRepository>;
