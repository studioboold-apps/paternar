/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { and, count, desc, eq, gte, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { sessionsTable } from '../Auth/auth.table';
import { childrenTable } from '../Child/child.table';
import { communityPostsTable } from '../CommunityPost/community-post.table';
import { usersTable } from '../User/user.table';

export type PanelOverview = {
  readonly users: number;
  readonly usersOnboarded: number;
  readonly usersLast7Days: number;
  readonly usersLast30Days: number;
  readonly children: number;
  readonly communityPosts: number;
  /** Cadastros por dia nos ultimos 30 dias, no fuso de Sao Paulo. */
  readonly signupsByDay: readonly { readonly day: string; readonly total: number }[];
};

/**
 * O que a equipe ve de um pai. De proposito NAO entra: foto, idade, estado
 * civil, e nada de filho alem da contagem — o painel serve para acompanhar o
 * produto, nao para olhar a vida de ninguem (LGPD art. 6, III: necessidade).
 */
export type PanelUserRow = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly city: string | null;
  readonly onboardingCompleted: boolean;
  readonly childrenCount: number;
  readonly createdAt: Date;
  /** Quando a equipe bloqueou; nulo e' liberado. */
  readonly blockedAt: Date | null;
};

export type ListPanelUsersParams = {
  readonly page: number;
  readonly perPage: number;
  readonly search?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function createPanelRepository(database: Database) {
  return {
    /**
     * Recuperacao de acesso do painel: grava a senha nova no formato do
     * `user-module` (Bun.password), reativa e devolve o papel de admin. O
     * e-mail casa sem diferenciar maiusculas, que e' o erro mais comum.
     */
    async resetAdminPassword(input: { readonly email: string; readonly password: string }): Promise<number> {
      const passwordHash = await Bun.password.hash(input.password);
      const result = await database.execute(sql`
        update "user"."users"
           set password_hash = ${passwordHash}, is_active = true, role = 'admin', updated_at = now()
         where lower(email) = lower(${input.email.trim()}) and deleted_at is null
         returning id
      `);
      return (result as unknown as readonly unknown[]).length;
    },

    /**
     * A conta de pai com o mesmo e-mail do acesso do painel: e' para ela que o
     * "Enviar teste para mim" manda. Pai bloqueado nao recebe nem teste.
     */
    async findAppUserIdForStaff(staffUserId: string): Promise<string | undefined> {
      const rows = (await database.execute(sql`
        select app.id
          from ${usersTable} app
          join "user"."users" staff on lower(staff.email) = lower(app.email)
         where staff.id::text = ${staffUserId}
           and staff.deleted_at is null
           and app.blocked_at is null
         limit 1
      `)) as unknown as readonly { readonly id: string }[];
      return rows[0]?.id;
    },

    async overview(now: Date = new Date()): Promise<PanelOverview> {
      const since7 = new Date(now.getTime() - 7 * DAY_MS);
      const since30 = new Date(now.getTime() - 30 * DAY_MS);

      const [[users], [children], [posts], byDay] = await Promise.all([
        database
          .select({
            total: count(),
            onboarded: sql<number>`count(*) filter (where ${usersTable.onboardingCompleted})::int`,
            last7: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since7.toISOString()})::int`,
            last30: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since30.toISOString()})::int`,
          })
          .from(usersTable),
        database.select({ total: count() }).from(childrenTable),
        database.select({ total: count() }).from(communityPostsTable),
        database
          .select({
            day: sql<string>`to_char(${usersTable.createdAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
            total: sql<number>`count(*)::int`,
          })
          .from(usersTable)
          .where(gte(usersTable.createdAt, since30))
          .groupBy(sql`1`)
          .orderBy(sql`1`),
      ]);

      return {
        users: Number(users?.total ?? 0),
        usersOnboarded: Number(users?.onboarded ?? 0),
        usersLast7Days: Number(users?.last7 ?? 0),
        usersLast30Days: Number(users?.last30 ?? 0),
        children: Number(children?.total ?? 0),
        communityPosts: Number(posts?.total ?? 0),
        signupsByDay: byDay.map((row) => ({ day: String(row.day), total: Number(row.total) })),
      };
    },

    /**
     * Bloqueia (ou libera) um pai. Bloquear tambem revoga as sessoes dele, na
     * mesma transacao: o refresh guardado no navegador deixa de valer na hora.
     * Devolve `undefined` se o pai nao existe.
     */
    async setUserBlocked(input: {
      readonly userId: string;
      readonly blocked: boolean;
    }): Promise<{ readonly id: string; readonly blockedAt: Date | null } | undefined> {
      return await database.transaction(async (transaction) => {
        const [row] = await transaction
          .update(usersTable)
          .set({ blockedAt: input.blocked ? new Date() : null, updatedAt: new Date() })
          .where(eq(usersTable.id, input.userId))
          .returning({ id: usersTable.id, blockedAt: usersTable.blockedAt });
        if (row === undefined) return undefined;
        if (input.blocked) {
          await transaction
            .update(sessionsTable)
            .set({ revokedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(sessionsTable.userId, input.userId), isNull(sessionsTable.revokedAt)));
        }
        return row;
      });
    },

    async listUsers(params: ListPanelUsersParams): Promise<{ rows: PanelUserRow[]; total: number }> {
      const conditions: SQL[] = [];
      if (params.search) {
        const pattern = `%${escapeLike(params.search)}%`;
        const match = or(ilike(usersTable.email, pattern), ilike(usersTable.fullName, pattern));
        if (match) conditions.push(match);
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const childrenCount = sql<number>`(select count(*)::int from ${childrenTable} where ${childrenTable.userId} = ${usersTable.id})`;

      const [rows, [counted]] = await Promise.all([
        database
          .select({
            id: usersTable.id,
            email: usersTable.email,
            fullName: usersTable.fullName,
            city: usersTable.city,
            onboardingCompleted: usersTable.onboardingCompleted,
            childrenCount,
            createdAt: usersTable.createdAt,
            blockedAt: usersTable.blockedAt,
          })
          .from(usersTable)
          .where(where)
          .orderBy(desc(usersTable.createdAt))
          .limit(params.perPage)
          .offset((params.page - 1) * params.perPage),
        database.select({ total: count() }).from(usersTable).where(where),
      ]);

      return {
        rows: rows.map((row) => ({ ...row, childrenCount: Number(row.childrenCount) })),
        total: Number(counted?.total ?? 0),
      };
    },
  };
}

export type PanelRepository = ReturnType<typeof createPanelRepository>;
