/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { LlmUsage } from '../Ai/types/ai.types';

/** Preco em dolar por MILHAO de tokens. */
export type ModelPrice = {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
};

/**
 * Tabela de precos da API (nov/2026). Cache: leitura ~10% e escrita ~125% da
 * entrada. Modelo fora da tabela conta tokens e custo zero: o painel mostra o
 * uso, e o preco entra aqui quando o modelo for adotado.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
};

/** Busca na web da Anthropic: US$ 10 a cada mil buscas. */
export const WEB_SEARCH_PRICE_USD = 0.01;

const MICRO = 1_000_000;


/** O modelo vem do provedor as vezes com data no fim (`-20261001`): casa pelo prefixo. */
export function findModelPrice(model: string): ModelPrice | undefined {
  const exact = MODEL_PRICES[model];
  if (exact) return exact;
  const prefix = Object.keys(MODEL_PRICES).find((name) => model.startsWith(`${name}-`));
  return prefix === undefined ? undefined : MODEL_PRICES[prefix];
}

export function computeCostMicroUsd(usage: LlmUsage): number {
  const price = findModelPrice(usage.model);
  const tokens = price
    ? usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite
    : 0;
  // tokens x (US$/milhao) ja' e' micro-dolar.
  return Math.round(tokens + usage.webSearches * WEB_SEARCH_PRICE_USD * MICRO);
}
