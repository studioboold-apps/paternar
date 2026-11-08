/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { and, eq } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { communityCommentsTable } from '../CommunityComment/community-comment.table';
import { communityPostsTable } from '../CommunityPost/community-post.table';
import { REPORT_SNAPSHOT_MAX_LENGTH } from './community-report.constant';
import { communityReportsTable } from './community-report.table';
import type { CommunityReportRepository } from './types/community-report.types';

const VIEW_COLUMNS = {
  id: communityReportsTable.id,
  status: communityReportsTable.status,
  createdAt: communityReportsTable.createdAt,
} as const;

export function createCommunityReportRepository(database: Database): CommunityReportRepository {
  return {
    async findTarget({ targetType, targetId }) {
      if (targetType === 'post') {
        const [post] = await database
          .select({ authorId: communityPostsTable.authorId, content: communityPostsTable.content })
          .from(communityPostsTable)
          .where(eq(communityPostsTable.id, targetId))
          .limit(1);
        return post ? { ...post, postId: targetId, commentId: null } : undefined;
      }
      const [comment] = await database
        .select({
          authorId: communityCommentsTable.authorId,
          content: communityCommentsTable.content,
          postId: communityCommentsTable.postId,
        })
        .from(communityCommentsTable)
        .where(eq(communityCommentsTable.id, targetId))
        .limit(1);
      return comment ? { ...comment, commentId: targetId } : undefined;
    },

    async findOpen({ reporterId, targetType, targetId }) {
      const column = targetType === 'post' ? communityReportsTable.postId : communityReportsTable.commentId;
      const [row] = await database
        .select(VIEW_COLUMNS)
        .from(communityReportsTable)
        .where(
          and(
            eq(communityReportsTable.reporterId, reporterId),
            eq(communityReportsTable.targetType, targetType),
            eq(column, targetId),
            eq(communityReportsTable.status, 'open'),
          ),
        )
        .limit(1);
      return row;
    },

    async insert({ reporterId, targetType, target, values }) {
      const [row] = await database
        .insert(communityReportsTable)
        .values({
          reporterId,
          reportedUserId: target.authorId,
          targetType,
          postId: target.postId,
          commentId: target.commentId,
          contentSnapshot: target.content.slice(0, REPORT_SNAPSHOT_MAX_LENGTH),
          reason: values.reason,
          details: values.details && values.details.length > 0 ? values.details : null,
        })
        .returning(VIEW_COLUMNS);
      if (row === undefined) throw new Error('insert de denuncia nao devolveu linha');
      return row;
    },
  };
}
