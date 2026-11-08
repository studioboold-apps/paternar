/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import type { LlmUsage } from '../Ai/types/ai.types';
import { computeCostMicroUsd, findModelPrice } from './ai-usage.constant';
import { createAiUsageRecorder } from './ai-usage.repository';

const BASE: LlmUsage = {
  provider: 'anthropic',
  model: 'claude-haiku-5-5',
  task: 'chat',
  userId: '11111111-1111-4111-8111-111111111111',
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
};

describe('custo da chamada de IA', () => {
  test('um milhao de tokens de entrada no Haiku 5.5 custa 10 centavos de dolar', () => {
    expect(computeCostMicroUsd({ ...BASE, inputTokens: 1_000_000 })).toBe(100_000);
  });

  test('soma entrada, saida, cache e busca na web', () => {
    const cost = computeCostMicroUsd({
      ...BASE,
      inputTokens: 2_000,
      outputTokens: 1_000,
      cacheReadTokens: 10_000,
      cacheWriteTokens: 4_000,
      webSearches: 2,
    });
    // 2000*0.1 + 1000*0.5 + 10000*0.01 + 4000*0.125 + 2*10000
    expect(cost).toBe(200 + 500 + 100 + 500 + 20_000);
  });

  test('modelo com data no fim usa o preco do modelo base', () => {
    expect(findModelPrice('claude-haiku-5-5-20261001')).toEqual(findModelPrice('claude-haiku-5-5'));
  });

  test('modelo desconhecido conta custo zero, mas a busca ainda e cobrada', () => {
    expect(computeCostMicroUsd({ ...BASE, model: 'modelo-novo', inputTokens: 9_999 })).toBe(0);
    expect(computeCostMicroUsd({ ...BASE, model: 'modelo-novo', webSearches: 1 })).toBe(10_000);
  });
});

describe('gravacao do uso', () => {
  test('grava a linha com o custo calculado e sem conteudo da conversa', async () => {
    const rows: unknown[] = [];
    const record = createAiUsageRecorder({ insert: async (row) => rows.push(row) });
    record({ ...BASE, inputTokens: 1_000_000 });
    await Promise.resolve();
    expect(rows).toEqual([
      {
        userId: BASE.userId,
        task: 'chat',
        provider: 'anthropic',
        model: 'claude-haiku-5-5',
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        webSearches: 0,
        costMicroUsd: 100_000,
      },
    ]);
  });

  test('falha ao gravar nao propaga para quem chamou a IA', async () => {
    const warnings: string[] = [];
    const logger = { warn: (message: string) => warnings.push(message) } as never;
    const record = createAiUsageRecorder({ insert: async () => Promise.reject(new Error('banco fora')), logger });
    expect(() => record(BASE)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnings).toEqual(['uso de IA nao gravado']);
  });
});
