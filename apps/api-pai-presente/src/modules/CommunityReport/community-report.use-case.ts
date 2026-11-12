/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { ERROR_CODES } from '../shared/errors/codes';
import { ResourceNotFoundError } from '../shared/errors/shared.error';
import type {
  CommunityReportRepository,
  CommunityReportView,
  CreateCommunityReportParams,
} from './types/community-report.types';

export type CommunityReportUseCases = {
  /** Devolve `created: false` quando o pai ja' tinha denunciado e a equipe nao decidiu ainda. */
  report(params: CreateCommunityReportParams): Promise<{ readonly report: CommunityReportView; readonly created: boolean }>;
};

export function createCommunityReportUseCases(repository: CommunityReportRepository): CommunityReportUseCases {
  return {
    async report(params) {
      const target = await repository.findTarget({ targetType: params.targetType, targetId: params.targetId });
      if (target === undefined) {
        throw params.targetType === 'post'
          ? new ResourceNotFoundError(ERROR_CODES.community.POST_NOT_FOUND, 'Post nao encontrado.')
          : new ResourceNotFoundError(ERROR_CODES.community.COMMENT_NOT_FOUND, 'Comentario nao encontrado.');
      }
      // Denunciar duas vezes nao vira duas linhas: a fila da equipe conta pais, nao toques.
      const existing = await repository.findOpen(params);
      if (existing !== undefined) return { report: existing, created: false };
      const report = await repository.insert({
        reporterId: params.reporterId,
        targetType: params.targetType,
        target,
        values: params.values,
      });
      return { report, created: true };
    },
  };
}
