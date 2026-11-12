/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { ActivityRepository } from '../Activity/types/activity.types';
import type { ChatMessageRepository } from '../ChatMessage/types/chat-message.types';
import { CHAT_ROLES } from '../shared/shared.constant';
import type { ChildRepository } from '../Child/types/child.types';
import type { UserRepository } from '../User/types/user.types';
import type { InsightRatingRepository } from '../InsightRating/types/insight-rating.types';
import { createRateLimiter } from '../shared/http/rate-limit';
import type { RouteDefinition } from '../shared/http/route.types';
import { AI_RATE_LIMIT, type LlmProviderName } from './ai.constant';
import { buildAiRoutes } from './ai.controller';
import { createAiUseCases } from './ai.use-case';
import { createLlmProvider } from './providers/provider.factory';
import { createTranscriber } from './providers/transcription.provider';
import type {
  ActivityDigestPort,
  ChatHistoryPort,
  ChildrenContextPort,
  FamilyValuesPort,
  InsightDigestPort,
  LlmTurn,
  LlmUsageSink,
  ParentRegionPort,
} from './types/ai.types';

export type BuildAiModuleParams = {
  readonly children: ChildRepository;
  readonly activities: ActivityRepository;
  readonly insights: InsightRatingRepository;
  readonly chatMessages: ChatMessageRepository;
  readonly users: UserRepository;
  readonly familyValues?: FamilyValuesPort;
  readonly providerName: LlmProviderName;
  readonly apiKey: string;
  readonly model: string;
  /** Modelo da faixa barata (insights e sugestoes). Vazio cai no padrao do provedor. */
  readonly modelFast?: string;
  readonly transcription: { readonly apiKey: string; readonly model: string };
  /** Conta de uso: recebe os tokens de cada chamada. Ausente, nada e' gravado. */
  readonly recordUsage?: LlmUsageSink;
};

/**
 * O modulo de IA nao conhece tabela de ninguem: cada porta e uma leitura
 * estreita, adaptada aqui sobre o repositorio que ja existe.
 */
function adaptChildrenContext(repository: ChildRepository): ChildrenContextPort {
  return { listByUser: (userId) => repository.listContext(userId) };
}

function adaptActivityDigest(repository: ActivityRepository): ActivityDigestPort {
  return {
    listMonth: (params) => repository.listMonthDigest(params),
    listRecent: (params) => repository.listRecentDigest(params),
  };
}

function adaptInsightDigest(repository: InsightRatingRepository): InsightDigestPort {
  return { listMonth: (params) => repository.listMonthDigest(params) };
}

function adaptParentRegion(repository: UserRepository): ParentRegionPort {
  return {
    findCity: async (userId) => (await repository.findById({ userId }))?.city ?? undefined,
  };
}

function isChatRole(role: string): role is LlmTurn['role'] {
  return (CHAT_ROLES as readonly string[]).includes(role);
}

/** So' papel e texto atravessam: id, data e dono da linha nao interessam a IA. */
function adaptChatHistory(repository: ChatMessageRepository): ChatHistoryPort {
  return {
    listRecent: async (params) => {
      const rows = await repository.listRecent(params);
      return rows.flatMap(({ role, content }) => (isChatRole(role) ? [{ role, content }] : []));
    },
  };
}

export function buildAiModule({
  children,
  activities,
  insights,
  chatMessages,
  users,
  familyValues,
  providerName,
  apiKey,
  model,
  modelFast = '',
  transcription,
  recordUsage,
}: BuildAiModuleParams): readonly RouteDefinition[] {
  const useCases = createAiUseCases({
    provider: createLlmProvider({ providerName, apiKey, model, modelFast, onUsage: recordUsage }),
    children: adaptChildrenContext(children),
    activities: adaptActivityDigest(activities),
    insights: adaptInsightDigest(insights),
    chatHistory: adaptChatHistory(chatMessages),
    transcriber: createTranscriber(transcription),
    region: adaptParentRegion(users),
    ...(familyValues === undefined ? {} : { familyValues }),
  });

  // Um limitador por MODULO, nao por rota: as quatro rotas gastam da mesma
  // conta, entao o teto tambem e o mesmo.
  return buildAiRoutes({ useCases, rateLimiter: createRateLimiter(AI_RATE_LIMIT) });
}
