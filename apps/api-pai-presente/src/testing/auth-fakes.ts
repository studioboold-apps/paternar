/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { randomUUID } from 'node:crypto';

import type { TokenAuthProvider } from '../modules/Auth/auth.constant';
import { EmailAlreadyRegisteredError, IdentityTokenInvalidError } from '../modules/Auth/auth.error';
import type {
  AuthAccountRepository,
  CreateSessionParams,
  IdentityVerifierRegistry,
  PasswordAccountRepository,
  PasswordCredential,
  PasswordHasher,
  ProviderIdentity,
  SessionRecord,
  SessionRepository,
} from '../modules/Auth/types/auth.types';
import type { AuthenticatedUser } from '../modules/shared/auth/authenticated-user.interface';

export const VALID_GOOGLE_TOKEN = 'id-token-valido';

export const GOOGLE_IDENTITY: ProviderIdentity = {
  subject: 'google-sub-1',
  email: 'pai@example.com',
  fullName: 'Pai Exemplo',
};

/** Apple fica de fora de proposito: e o provedor "nao configurado" dos testes. */
export function createFakeVerifierRegistry(): IdentityVerifierRegistry {
  return {
    forProvider(provider: TokenAuthProvider) {
      if (provider !== 'google') return undefined;
      return {
        verify: async (idToken: string) => {
          if (idToken !== VALID_GOOGLE_TOKEN) throw new IdentityTokenInvalidError();
          return GOOGLE_IDENTITY;
        },
      };
    },
  };
}

export type FakeAccountRepository = AuthAccountRepository & {
  /** Faz o papel do bloqueio pelo painel (`users.blocked_at`). */
  readonly block: (userId: string) => void;
};

export function createFakeAccountRepository(): FakeAccountRepository {
  const blockedUserIds = new Set<string>();
  const usersByEmail = new Map<string, AuthenticatedUser>();
  const usersById = new Map<string, AuthenticatedUser>();
  const identities = new Map<string, string>();

  return {
    async findOrCreateByIdentity({ provider, identity }) {
      const key = `${provider}:${identity.subject}`;
      const linkedUserId = identities.get(key);
      if (linkedUserId !== undefined) return usersById.get(linkedUserId) as AuthenticatedUser;

      const user = usersByEmail.get(identity.email) ?? {
        userId: randomUUID(),
        email: identity.email,
      };
      usersByEmail.set(user.email, user);
      usersById.set(user.userId, user);
      identities.set(key, user.userId);
      return user;
    },
    async findById(userId: string) {
      const user = usersById.get(userId);
      if (user === undefined) throw new Error('usuario inexistente');
      return user;
    },
    async isBlocked(userId: string) {
      return blockedUserIds.has(userId);
    },
    block(userId: string) {
      blockedUserIds.add(userId);
    },
  };
}

export type FakeSessionRepository = SessionRepository & {
  readonly countLiveSessions: () => number;
};

export function createFakeSessionRepository(): FakeSessionRepository {
  const byHash = new Map<string, SessionRecord>();

  return {
    async findByRefreshTokenHash(refreshTokenHash: string) {
      return byHash.get(refreshTokenHash);
    },
    async insert({ userId, refreshTokenHash, expiresAt }: CreateSessionParams) {
      const session: SessionRecord = { id: randomUUID(), userId, expiresAt, revokedAt: null };
      byHash.set(refreshTokenHash, session);
      return session;
    },
    async revokeById(sessionId: string) {
      for (const [hash, stored] of byHash) {
        if (stored.id === sessionId) byHash.set(hash, { ...stored, revokedAt: new Date() });
      }
    },
    async revokeAllForUser(userId: string) {
      for (const [hash, stored] of byHash) {
        if (stored.userId === userId) byHash.set(hash, { ...stored, revokedAt: new Date() });
      }
    },
    countLiveSessions() {
      let live = 0;
      for (const stored of byHash.values()) if (stored.revokedAt === null) live += 1;
      return live;
    },
  };
}

/**
 * Hash de mentira, e de proposito: `argon2id` gasta centenas de milissegundos
 * por chamada — o custo que protege a senha em producao e o mesmo que faria a
 * suite arrastar. Quem verifica o hash de verdade e' `password.service.test.ts`,
 * que roda pouquissimas vezes.
 */
export function createFakePasswordHasher(): PasswordHasher {
  return {
    async hash(password: string) {
      return `hash:${password}`;
    },
    async verify({ password, passwordHash }) {
      if (passwordHash === undefined) return false;
      return passwordHash === `hash:${password}`;
    },
  };
}

export function createFakePasswordAccountRepository(): PasswordAccountRepository {
  const credentialsByEmail = new Map<string, PasswordCredential>();

  return {
    async create({ email, passwordHash }) {
      if (credentialsByEmail.has(email)) throw new EmailAlreadyRegisteredError();
      const user: AuthenticatedUser = { userId: randomUUID(), email };
      credentialsByEmail.set(email, { user, passwordHash });
      return user;
    },
    async findCredentialByEmail(email: string) {
      return credentialsByEmail.get(email);
    },
  };
}
