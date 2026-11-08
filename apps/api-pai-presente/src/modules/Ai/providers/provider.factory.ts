/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { DEFAULT_MODELS, type LlmProviderName, type LlmTier } from '../ai.constant';
import { LlmNotConfiguredError } from '../ai.error';
import type { LlmProvider, LlmUsageSink } from '../types/ai.types';
import { createAnthropicProvider } from './anthropic.provider';
import { createOpenAiProvider } from './openai.provider';

export type CreateLlmProviderParams = {
  readonly providerName: LlmProviderName;
  readonly apiKey: string;
  /** Faixa principal (chat e boletim). Vazio cai no padrao do provedor. */
  readonly model: string;
  /** Faixa barata (insights e sugestoes). Vazio cai no padrao do provedor. */
  readonly modelFast?: string;
  /** Recebe os tokens de cada chamada (painel: uso e custo de IA). */
  readonly onUsage?: LlmUsageSink | undefined;
};

const BUILDERS = {
  anthropic: createAnthropicProvider,
  openai: createOpenAiProvider,
} as const satisfies Record<
  LlmProviderName,
  (params: {
    apiKey: string;
    models: Readonly<Record<LlmTier, string>>;
    onUsage?: LlmUsageSink | undefined;
  }) => LlmProvider
>;

/**
 * Sem chave, ninguem chama a rede: a chamada sairia com credencial vazia e
 * voltaria 502, como se o terceiro tivesse falhado. Recusar aqui, uma vez so,
 * vale para as quatro rotas de IA.
 */
function createUnconfiguredProvider(providerName: LlmProviderName): LlmProvider {
  // `async` de proposito: o contrato devolve promessa, e quem chama trata a
  // falha com `catch` — lancar sincrono escaparia desse caminho.
  async function refuse(): Promise<never> {
    throw new LlmNotConfiguredError(providerName);
  }
  return { name: providerName, generateText: refuse, generateStructured: refuse };
}

export function createLlmProvider({
  providerName,
  apiKey,
  model,
  modelFast = '',
  onUsage,
}: CreateLlmProviderParams): LlmProvider {
  if (apiKey.length === 0) return createUnconfiguredProvider(providerName);

  const defaults = DEFAULT_MODELS[providerName];
  return BUILDERS[providerName]({
    apiKey,
    models: {
      main: model.length > 0 ? model : defaults.main,
      fast: modelFast.length > 0 ? modelFast : defaults.fast,
    },
    onUsage,
  });
}
