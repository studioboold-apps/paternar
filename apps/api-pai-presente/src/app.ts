/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { Database } from './database/client';
import type { NotificationModule } from '@adatechnology/notification-module';
import { buildActivityRoutes } from './modules/Activity/activity.controller';
import { buildAiModule } from './modules/Ai/ai.module';
import type { LlmProviderName } from './modules/Ai/ai.constant';
import { createActivityRepository } from './modules/Activity/activity.repository';
import { createActivityUseCases } from './modules/Activity/activity.use-case';
import { buildChatMessageRoutes } from './modules/ChatMessage/chat-message.controller';
import { createChatMessageRepository } from './modules/ChatMessage/chat-message.repository';
import { createChatMessageUseCases } from './modules/ChatMessage/chat-message.use-case';
import { buildChildConsentRoutes } from './modules/ChildConsent/child-consent.controller';
import { createChildConsentRepository } from './modules/ChildConsent/child-consent.repository';
import { createChildConsentUseCases } from './modules/ChildConsent/child-consent.use-case';
import { buildChildFileRoutes } from './modules/ChildFile/child-file.controller';
import { createChildFileRepository } from './modules/ChildFile/child-file.repository';
import { createChildFileUseCases } from './modules/ChildFile/child-file.use-case';
import { buildChildRoutes } from './modules/Child/child.controller';
import { createChildRepository } from './modules/Child/child.repository';
import { createChildUseCases } from './modules/Child/child.use-case';
import type { ChildRepository } from './modules/Child/types/child.types';
import { buildCommunityCommentRoutes } from './modules/CommunityComment/community-comment.controller';
import { createCommunityCommentRepository } from './modules/CommunityComment/community-comment.repository';
import { createCommunityCommentUseCases } from './modules/CommunityComment/community-comment.use-case';
import { buildCommunityPostRoutes } from './modules/CommunityPost/community-post.controller';
import { createCommunityPostRepository } from './modules/CommunityPost/community-post.repository';
import { createCommunityPostUseCases } from './modules/CommunityPost/community-post.use-case';
import type { CommunityPostRepository } from './modules/CommunityPost/types/community-post.types';
import { buildCommunityReportRoutes } from './modules/CommunityReport/community-report.controller';
import { createCommunityReportRepository } from './modules/CommunityReport/community-report.repository';
import { createCommunityReportUseCases } from './modules/CommunityReport/community-report.use-case';
import { buildFamilyValuesRoutes } from './modules/FamilyValues/family-values.controller';
import { createFamilyValuesRepository } from './modules/FamilyValues/family-values.repository';
import { createFamilyValuesUseCases } from './modules/FamilyValues/family-values.use-case';
import { buildInsightRatingRoutes } from './modules/InsightRating/insight-rating.controller';
import { createInsightRatingRepository } from './modules/InsightRating/insight-rating.repository';
import { createInsightRatingUseCases } from './modules/InsightRating/insight-rating.use-case';
import { createDatabaseAiUsageRecorder } from './modules/AiUsage/ai-usage.repository';
import { recordAuditEntry } from './modules/Audit/audit.repository';
import { createMediaStorage, type CreateMediaStorageParams } from './modules/Media/media-storage.factory';
import type { PostExistencePort } from './modules/CommunityComment/types/community-comment.types';
import type { ChildOwnershipPort } from './modules/shared/child-ownership.interface';
import type { RouteDefinition } from './modules/shared/http/route.types';
import { buildUserRoutes } from './modules/User/user.controller';
import { createUserRepository } from './modules/User/user.repository';
import { createUserUseCases } from './modules/User/user.use-case';

/** O dono do filho ja e checado na busca escopada; a porta so expoe o booleano. */
function adaptChildOwnership(repository: ChildRepository): ChildOwnershipPort {
  return {
    isOwnedByUser: async ({ childId, userId }) =>
      (await repository.findById({ childId, userId })) !== undefined,
  };
}

function adaptPostExistence(repository: CommunityPostRepository): PostExistencePort {
  return { exists: (postId) => repository.exists(postId) };
}

export type BuildApplicationRoutesParams = {
  readonly database: Database;
  /**
   * Onde a foto e o exame ficam, e com que chave o exame e' fechado. A chave
   * chega codificada e nao e' lida aqui: quem a le' e' o use case, e so' quando
   * um exame aparece (`MEDIA_ENCRYPTION_KEY` ausente nao pode derrubar a API
   * para quem so' sobe foto).
   */
  readonly media: CreateMediaStorageParams & { readonly encryptionKey: string };
  /** Chave do provedor de IA: vive so aqui dentro, nunca sai numa resposta. */
  readonly llm: {
    readonly providerName: LlmProviderName;
    readonly apiKey: string;
    readonly model: string;
    /** Faixa barata (insights e sugestoes); vazia cai no padrao do provedor. */
    readonly modelFast?: string;
    /** Voz para texto (microfone do chat). Chave vazia so' desliga o microfone. */
    readonly transcription: { readonly apiKey: string; readonly model: string };
  };
  readonly notifications?: NotificationModule | undefined;
};

export function buildApplicationRoutes({
  database,
  llm,
  media,
  notifications,
}: BuildApplicationRoutesParams): readonly RouteDefinition[] {
  const childRepository = createChildRepository(database);
  /**
   * UMA instancia, dois papeis: ela ATENDE as rotas de consentimento e RESPONDE
   * a pergunta que o upload de exame faz. Montar duas faria a pergunta e a
   * resposta virem de codigos diferentes que concordam so' ate a primeira
   * edicao (`code-standart.md` §16).
   */
  const childConsentUseCases = createChildConsentUseCases({
    repository: createChildConsentRepository(database),
    childOwnership: adaptChildOwnership(childRepository),
    audit: { record: (entry) => recordAuditEntry({ executor: database, entry }) },
  });
  /**
   * UMA instancia, dois papeis, como a do consentimento: ela ATENDE as rotas de
   * arquivo e VARRE o balde quando um filho e' apagado. A cascata do banco leva
   * as linhas e nenhum byte, e quem conhece o balde e' este modulo.
   */
  const childFileUseCases = createChildFileUseCases({
    repository: createChildFileRepository(database),
    storage: createMediaStorage(media),
    childOwnership: adaptChildOwnership(childRepository),
    childConsent: childConsentUseCases,
    /**
     * A trilha do arquivo NAO pega carona em transacao: a escrita no balde
     * acontece fora dela, e uma linha de trilha que rola junto com o insert
     * diria "guardou" antes de haver byte guardado.
     */
    audit: { record: (entry) => recordAuditEntry({ executor: database, entry }) },
    encodedEncryptionKey: media.encryptionKey,
  });
  const communityPostRepository = createCommunityPostRepository(database);
  const activityRepository = createActivityRepository(database);
  const insightRatingRepository = createInsightRatingRepository(database);
  const chatMessageRepository = createChatMessageRepository(database);
  const userRepository = createUserRepository(database);
  const familyValuesUseCases = createFamilyValuesUseCases({
    repository: createFamilyValuesRepository(database),
    audit: { record: (entry) => recordAuditEntry({ executor: database, entry }) },
  });

  return [
    ...buildUserRoutes(
      createUserUseCases({
        repository: userRepository,
        childFiles: childFileUseCases,
        childFileExport: childFileUseCases,
      }),
    ),
    ...buildChildRoutes(createChildUseCases({ repository: childRepository, childFiles: childFileUseCases })),
    ...buildActivityRoutes(
      createActivityUseCases({
        repository: activityRepository,
        childOwnership: adaptChildOwnership(childRepository),
        notifications,
      }),
    ),
    ...buildChildFileRoutes(childFileUseCases),
    ...buildChildConsentRoutes(childConsentUseCases),
    ...buildInsightRatingRoutes(createInsightRatingUseCases(insightRatingRepository)),
    ...buildCommunityPostRoutes(createCommunityPostUseCases(communityPostRepository)),
    ...buildCommunityCommentRoutes(
      createCommunityCommentUseCases({
        repository: createCommunityCommentRepository(database),
        postExistence: adaptPostExistence(communityPostRepository),
      }),
    ),
    ...buildCommunityReportRoutes(createCommunityReportUseCases(createCommunityReportRepository(database))),
    ...buildChatMessageRoutes(createChatMessageUseCases(chatMessageRepository)),
    ...buildFamilyValuesRoutes(familyValuesUseCases),
    ...buildAiModule({
      familyValues: familyValuesUseCases,
      children: childRepository,
      activities: activityRepository,
      insights: insightRatingRepository,
      chatMessages: chatMessageRepository,
      users: userRepository,
      recordUsage: createDatabaseAiUsageRecorder(database),
      ...llm,
    }),
  ];
}
