/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { TRANSCRIPTION_ESTIMATE } from '../PlanLimits/plan-limits.constant';
import type { LlmUsage } from './types/ai.types';

/**
 * A transcricao entra na mesma conta de uso que o resto da IA. O Groq cobra por
 * segundo e nao devolve a duracao; ela e' estimada do tamanho do arquivo, e
 * `inputTokens` guarda SEGUNDOS de audio (o preco em `MODEL_PRICES` e' por
 * segundo, em micro-dolar).
 */
export function estimateAudioSeconds(bytes: number): number {
  const seconds = Math.ceil((bytes * 8) / TRANSCRIPTION_ESTIMATE.bitsPerSecond);
  return Math.max(TRANSCRIPTION_ESTIMATE.minimumSeconds, seconds);
}

export function transcriptionUsage(params: {
  readonly userId: string;
  readonly bytes: number;
  readonly model: string;
}): LlmUsage {
  return {
    provider: TRANSCRIPTION_ESTIMATE.provider,
    model: params.model || TRANSCRIPTION_ESTIMATE.defaultModel,
    task: 'transcription',
    userId: params.userId,
    inputTokens: estimateAudioSeconds(params.bytes),
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    webSearches: 0,
  };
}
