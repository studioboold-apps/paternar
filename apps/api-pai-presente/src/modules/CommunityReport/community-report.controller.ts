/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { HTTP_METHODS, HTTP_STATUS } from '../shared/http/http.constant';
import { parseJsonBody, parseWithSchema } from '../shared/http/request.util';
import { respondWithData } from '../shared/http/response.util';
import type { RouteDefinition } from '../shared/http/route.types';
import { uuidSchema } from '../shared/shared.schema';
import type { ReportTargetType } from './community-report.constant';
import { createCommunityReportBodySchema } from './community-report.schema';
import type { CommunityReportUseCases } from './community-report.use-case';

const TARGETS: readonly { readonly type: ReportTargetType; readonly path: string; readonly param: string }[] = [
  { type: 'post', path: '/v1/community/posts/:postId/reports', param: 'postId' },
  { type: 'comment', path: '/v1/community/comments/:commentId/reports', param: 'commentId' },
];

export function buildCommunityReportRoutes(useCases: CommunityReportUseCases): readonly RouteDefinition[] {
  return TARGETS.map(({ type, path, param }) => ({
    method: HTTP_METHODS.POST,
    path,
    summary: type === 'post' ? 'Denuncia um post da comunidade.' : 'Denuncia um comentario da comunidade.',
    handle: async ({ request, pathParams, authenticatedUser }) => {
      const targetId = parseWithSchema(uuidSchema, pathParams[param]);
      const values = await parseJsonBody(request, createCommunityReportBodySchema);
      const { report, created } = await useCases.report({
        reporterId: authenticatedUser.userId,
        targetType: type,
        targetId,
        values,
      });
      return respondWithData(report, created ? HTTP_STATUS.CREATED : HTTP_STATUS.OK);
    },
  }));
}
