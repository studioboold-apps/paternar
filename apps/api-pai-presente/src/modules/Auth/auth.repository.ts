/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../../database/client';
import type { AuthenticatedUser } from '../shared/auth/authenticated-user.interface';
import { usersTable } from '../User/user.table';
import { authIdentitiesTable, sessionsTable } from './auth.table';
import type {
  AuthAccountRepository,
  CreateSessionParams,
  FindOrCreateAccountParams,
  SessionRecord,
  SessionRepository,
} from './types/auth.types';

function toAuthenticatedUser(row: { readonly id: string; readonly email: string }): AuthenticatedUser {
  return { userId: row.id, email: row.email };
}

export function createAuthAccountRepository(database: Database): AuthAccountRepository {
  return {
    // Tudo numa transacao porque sao tres escritas que so fazem sentido juntas:
    // conta pela metade deixaria o proximo login criando um usuario duplicado.
    async findOrCreateByIdentity({
      provider,
      identity,
    }: FindOrCreateAccountParams): Promise<AuthenticatedUser> {
      return await database.transaction(async (transaction) => {
        const linked = await transaction
          .select({ id: usersTable.id, email: usersTable.email })
          .from(authIdentitiesTable)
          .innerJoin(usersTable, eq(usersTable.id, authIdentitiesTable.userId))
          .where(
            and(
              eq(authIdentitiesTable.provider, provider),
              eq(authIdentitiesTable.subject, identity.subject),
            ),
          )
          .limit(1);
        const alreadyLinked = linked[0];
        if (alreadyLinked !== undefined) return toAuthenticatedUser(alreadyLinked);

        const existing = await transaction
          .select({ id: usersTable.id, email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.email, identity.email))
          .limit(1);
        const user = existing[0] ?? (await insertUser());
        await transaction
          .insert(authIdentitiesTable)
          .values({ userId: user.id, provider, subject: identity.subject });
        return toAuthenticatedUser(user);

        async function insertUser(): Promise<{ readonly id: string; readonly email: string }> {
          const inserted = await transaction
            .insert(usersTable)
            .values({ email: identity.email, fullName: identity.fullName ?? null })
            .returning({ id: usersTable.id, email: usersTable.email });
          const row = inserted[0];
          if (row === undefined) throw new Error('insercao de usuario nao devolveu linha');
          return row;
        }
      });
    },

    async findById(userId: string): Promise<AuthenticatedUser> {
      const rows = await database
        .select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      const row = rows[0];
      if (row === undefined) throw new Error('sessao viva apontando para usuario inexistente');
      return toAuthenticatedUser(row);
    },

    async isBlocked(userId: string): Promise<boolean> {
      const rows = await database
        .select({ blockedAt: usersTable.blockedAt })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      return rows[0]?.blockedAt != null;
    },
  };
}

export function createSessionRepository(database: Database): SessionRepository {
  const columns = {
    id: sessionsTable.id,
    userId: sessionsTable.userId,
    expiresAt: sessionsTable.expiresAt,
    revokedAt: sessionsTable.revokedAt,
  };

  return {
    async findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRecord | undefined> {
      const rows = await database
        .select(columns)
        .from(sessionsTable)
        .where(eq(sessionsTable.refreshTokenHash, refreshTokenHash))
        .limit(1);
      return rows[0];
    },

    async insert(params: CreateSessionParams): Promise<SessionRecord> {
      const rows = await database.insert(sessionsTable).values(params).returning(columns);
      const row = rows[0];
      if (row === undefined) throw new Error('insercao de sessao nao devolveu linha');
      return row;
    },

    async revokeById(sessionId: string): Promise<void> {
      await database
        .update(sessionsTable)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(sessionsTable.id, sessionId));
    },

    async revokeAllForUser(userId: string): Promise<void> {
      await database
        .update(sessionsTable)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(sessionsTable.userId, userId), isNull(sessionsTable.revokedAt)));
    },
  };
}
