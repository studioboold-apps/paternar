/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { communityCommentsTable } from '../CommunityComment/community-comment.table';
import { communityPostsTable } from '../CommunityPost/community-post.table';
import { usersTable } from '../User/user.table';
import { buildIdentityColumns } from '../shared/columns.constant';
import { DOMAIN_VALUE_LENGTH } from '../shared/shared.constant';

/**
 * Denuncia de post ou comentario. O texto denunciado e' COPIADO na hora
 * (`content_snapshot`): quando a equipe remove o conteudo, o post some e o
 * vinculo vira nulo, mas a denuncia continua dizendo o que foi denunciado.
 *
 * `reported_user_id` e' o autor do conteudo: e' a coluna que faz "quantas
 * denuncias este pai recebeu" ser uma contagem simples na ficha do painel.
 */
export const communityReportsTable = pgTable(
  'community_reports',
  {
    ...buildIdentityColumns(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    reportedUserId: uuid('reported_user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    postId: uuid('post_id').references(() => communityPostsTable.id, { onDelete: 'set null' }),
    commentId: uuid('comment_id').references(() => communityCommentsTable.id, { onDelete: 'set null' }),
    contentSnapshot: text('content_snapshot').notNull(),
    reason: varchar('reason', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    details: text('details'),
    status: varchar('status', { length: DOMAIN_VALUE_LENGTH }).notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Id do acesso da EQUIPE (schema `user`), nao de um pai. */
    resolvedBy: uuid('resolved_by'),
  },
  (table) => [
    index('community_reports_status_idx').on(table.status, table.createdAt),
    index('community_reports_reported_user_idx').on(table.reportedUserId),
    index('community_reports_reporter_idx').on(table.reporterId),
  ],
);

export type CommunityReportRow = typeof communityReportsTable.$inferSelect;
export type NewCommunityReportRow = typeof communityReportsTable.$inferInsert;
