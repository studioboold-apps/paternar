/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

export const REPORT_TARGET_TYPES = ['post', 'comment'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** Motivos que o pai escolhe no app; o texto livre vai em `details`. */
export const REPORT_REASONS = ['ofensivo', 'spam', 'golpe', 'inadequado', 'outro'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * `open` espera a equipe; `dismissed` a equipe olhou e deixou; `removed` a
 * equipe tirou o conteudo do ar.
 */
export const REPORT_STATUSES = ['open', 'dismissed', 'removed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** O texto guardado da denuncia: o bastante para a equipe decidir, sem foto. */
export const REPORT_SNAPSHOT_MAX_LENGTH = 2000;
