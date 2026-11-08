/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { ReportTargetType } from '../community-report.constant';
import type { CreateCommunityReportBody } from '../community-report.schema';

/** O que a denuncia precisa saber do conteudo denunciado. */
export type ReportTarget = {
  readonly authorId: string;
  readonly content: string;
  readonly postId: string;
  readonly commentId: string | null;
};

export type CommunityReportView = {
  readonly id: string;
  readonly status: string;
  readonly createdAt: Date;
};

export type CreateCommunityReportParams = {
  readonly reporterId: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly values: CreateCommunityReportBody;
};

export type CommunityReportRepository = {
  findTarget(params: { readonly targetType: ReportTargetType; readonly targetId: string }): Promise<ReportTarget | undefined>;
  /** Denuncia ainda aberta do mesmo pai sobre o mesmo conteudo. */
  findOpen(params: {
    readonly reporterId: string;
    readonly targetType: ReportTargetType;
    readonly targetId: string;
  }): Promise<CommunityReportView | undefined>;
  insert(params: {
    readonly reporterId: string;
    readonly targetType: ReportTargetType;
    readonly target: ReportTarget;
    readonly values: CreateCommunityReportBody;
  }): Promise<CommunityReportView>;
};
