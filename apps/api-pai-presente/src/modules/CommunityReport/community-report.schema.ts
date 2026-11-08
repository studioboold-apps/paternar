/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { z } from 'zod';

import { FREE_TEXT_MAX_LENGTH } from '../shared/shared.constant';
import { REPORT_REASONS } from './community-report.constant';

export const createCommunityReportBodySchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(FREE_TEXT_MAX_LENGTH).optional(),
  })
  .strict();

export type CreateCommunityReportBody = z.infer<typeof createCommunityReportBodySchema>;
