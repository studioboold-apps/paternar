/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { Database } from '../../database/client';
import type { Logger } from '../shared/logger/logger';
import type { LlmUsageSink } from '../Ai/types/ai.types';
import { computeCostMicroUsd } from './ai-usage.constant';
import { aiUsageTable } from './ai-usage.table';

export type AiUsageRecorder = LlmUsageSink;

/**
 * Grava em segundo plano: a resposta ao pai nunca espera nem cai por causa da
 * conta. Falha vira log (sem conteudo, so' o motivo).
 */
export function createAiUsageRecorder(params: {
  readonly insert: (row: typeof aiUsageTable.$inferInsert) => Promise<unknown>;
  readonly logger?: Logger;
}): AiUsageRecorder {
  return (usage) => {
    const row = {
      userId: usage.userId ?? null,
      task: usage.task,
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      webSearches: usage.webSearches,
      costMicroUsd: computeCostMicroUsd(usage),
    };
    void params.insert(row).catch((error: unknown) => {
      params.logger?.warn('uso de IA nao gravado', {
        reason: error instanceof Error ? error.name : 'desconhecido',
      });
    });
  };
}

export function createDatabaseAiUsageRecorder(database: Database, logger?: Logger): AiUsageRecorder {
  return createAiUsageRecorder({
    insert: (row) => database.insert(aiUsageTable).values(row),
    ...(logger ? { logger } : {}),
  });
}
