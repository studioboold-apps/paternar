/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { readSeedEnvironment } from '../config/environment';
import { createActivityRepository } from '../modules/Activity/activity.repository';
import { createActivityUseCases } from '../modules/Activity/activity.use-case';
import { createAuthAccountRepository, createSessionRepository } from '../modules/Auth/auth.repository';
import { createPasswordAccountRepository } from '../modules/Auth/password.repository';
import { createPasswordHasher } from '../modules/Auth/password.service';
import { createAuthUseCases } from '../modules/Auth/auth.use-case';
import { createIdentityVerifierRegistry } from '../modules/Auth/providers/verifier-registry';
import { createTokenService } from '../modules/Auth/token.service';
import { createChatMessageRepository } from '../modules/ChatMessage/chat-message.repository';
import { createChatMessageUseCases } from '../modules/ChatMessage/chat-message.use-case';
import { createChildRepository } from '../modules/Child/child.repository';
import { createChildUseCases } from '../modules/Child/child.use-case';
import { createCommunityCommentRepository } from '../modules/CommunityComment/community-comment.repository';
import { createCommunityCommentUseCases } from '../modules/CommunityComment/community-comment.use-case';
import { createCommunityPostRepository } from '../modules/CommunityPost/community-post.repository';
import { createCommunityPostUseCases } from '../modules/CommunityPost/community-post.use-case';
import { createLogger } from '../modules/shared/logger/logger';
import { createUserRepository } from '../modules/User/user.repository';
import { createUserUseCases } from '../modules/User/user.use-case';
import type { ChildFilePurgePort } from '../modules/shared/child-file-purge.interface';
import type { ChildFileExportPort } from '../modules/shared/child-file-export.interface';
import { bootstrapNotificationTemplates } from '../modules/Notification/seed-templates';
import { createDatabaseClient, type Database } from './client';
import { SEED_LIST_LIMIT } from './seed.constant';
import { runSeed } from './seed.service';
import type { SeedPorts } from './seed.types';

const SEED_PAGE = { limit: SEED_LIST_LIMIT, offset: 0 } as const;
const SEED_TRACE_ID = 'seed';

export type BuildSeedPortsParams = {
  readonly database: Database;
  readonly jwtSecret: string;
  readonly isProduction: boolean;
};

/**
 * Raiz de composicao do seed: os MESMOS use cases que a rota usa (code-standart §5).
 * Os adaptadores aqui sao de uma linha porque as portas pedem so a chave natural —
 * a regra continua inteira do lado do use case.
 */
export function buildSeedPorts({
  database,
  jwtSecret,
  isProduction,
}: BuildSeedPortsParams): SeedPorts {
  const auth = createAuthUseCases({
    verifiers: createIdentityVerifierRegistry({
      clientIds: {},
      developmentSignIn: { isEnabled: true, isProduction },
      // O seed entra pelo token de desenvolvimento, nunca por senha.
      isPasswordSignInEnabled: false,
    }),
    accounts: createAuthAccountRepository(database),
    passwordAccounts: createPasswordAccountRepository(database),
    passwordHasher: createPasswordHasher(),
    isPasswordSignInEnabled: false,
    sessions: createSessionRepository(database),
    tokenService: createTokenService(jwtSecret),
  });

  /**
   * O seed semeia, nunca apaga: nao ha' balde montado aqui. A porta recusa em
   * voz alta em vez de devolver sucesso — varredura que nao varre deixaria byte
   * de exame para tras no dia em que alguem apagasse a partir do seed.
   */
  const childFiles: ChildFilePurgePort = {
    purgeByChild: async () => {
      throw new Error('o seed nao apaga arquivo de filho');
    },
    purgeByUser: async () => {
      throw new Error('o seed nao apaga arquivo de filho');
    },
  };

  /** Mesmo motivo: exportar sem balde montado devolveria album vazio como se fosse a verdade. */
  const childFileExport: ChildFileExportPort = {
    listForExport: async () => {
      throw new Error('o seed nao exporta arquivo de filho');
    },
  };

  const users = createUserUseCases({
    repository: createUserRepository(database),
    childFiles,
    childFileExport,
  });
  const childRepository = createChildRepository(database);
  const children = createChildUseCases({ repository: childRepository, childFiles });
  const activities = createActivityUseCases({
    repository: createActivityRepository(database),
    childOwnership: {
      isOwnedByUser: async ({ childId, userId }) =>
        (await childRepository.findById({ childId, userId })) !== undefined,
    },
  });
  const postRepository = createCommunityPostRepository(database);
  const posts = createCommunityPostUseCases(postRepository);
  const comments = createCommunityCommentUseCases({
    repository: createCommunityCommentRepository(database),
    postExistence: { exists: (postId) => postRepository.exists(postId) },
  });
  const chat = createChatMessageUseCases(createChatMessageRepository(database));

  return {
    auth: {
      async signIn(params) {
        const session = await auth.signIn(params);
        return { userId: session.user.userId, refreshTokenValue: session.refreshTokenValue };
      },
      signOut: (refreshTokenValue) => auth.signOut(refreshTokenValue),
    },

    users: {
      async updateProfile(params) {
        await users.updateMe(params);
      },
    },

    children: {
      async list(userId) {
        const { items } = await children.list({ userId, ...SEED_PAGE });
        return items.map(({ id, name }) => ({ id, name }));
      },
      async create(params) {
        const { id, name } = await children.create(params);
        return { id, name };
      },
    },

    activities: {
      async listTitles(userId) {
        const { items } = await activities.list({ userId, filters: {}, ...SEED_PAGE });
        return items.map((activity) => activity.title);
      },
      async create(params) {
        await activities.create(params);
      },
    },

    posts: {
      async list(viewerId) {
        const { items } = await posts.list({ viewerId, filters: {}, ...SEED_PAGE });
        return items.map(({ id, content, hasLiked }) => ({ id, content, hasLiked }));
      },
      async create(params) {
        const { id, content, hasLiked } = await posts.create(params);
        return { id, content, hasLiked };
      },
      async like(params) {
        await posts.like(params);
      },
    },

    comments: {
      async listContents(postId) {
        const { items } = await comments.list({ postId, ...SEED_PAGE });
        return items.map((comment) => comment.content);
      },
      async create(params) {
        await comments.create(params);
      },
    },

    chat: {
      async listContents({ userId, conversationId }) {
        const { items } = await chat.list({ userId, conversationId, ...SEED_PAGE });
        return items.map((message) => message.content);
      },
      async create(params) {
        await chat.create(params);
      },
    },
  };
}

const environment = readSeedEnvironment();

const databaseClient = createDatabaseClient(environment.DATABASE_URL);
await bootstrapNotificationTemplates(databaseClient);

const summary = await runSeed({
  ports: buildSeedPorts({
    database: databaseClient,
    jwtSecret: environment.AUTH_JWT_SECRET,
    isProduction: environment.NODE_ENV === 'production',
  }),
  today: new Date(),
});

/** O resumo E a medicao do aceite: a segunda rodada tem de sair toda em zero. */
createLogger({ traceId: SEED_TRACE_ID, source: 'seed' }).info('seed aplicado', { ...summary });
