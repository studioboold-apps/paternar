/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Como o `payment-module` acha o pai que pagou. O modulo nao le a tabela
 * `users`: pergunta por esta porta.
 *
 * E-mail so vale de Google ou Apple. O cadastro por senha nao confirma o
 * e-mail, e sem essa regra quem criasse conta com o e-mail de outro comprador
 * ficava com a assinatura dele. Quem entra por senha e compra pelo app nao
 * perde nada: o link do checkout leva o id dele (`xcod`), e o e-mail nem e'
 * consultado.
 */

import type { CustomerResolverPort } from '@adatechnology/payment-contracts';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { OIDC_AUTH_PROVIDERS } from '../Auth/auth.constant';
import { authIdentitiesTable } from '../Auth/auth.table';
import { usersTable } from '../User/user.table';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createBillingCustomerResolver(database: Database): CustomerResolverPort {
  const verifiedEmail = sql`exists (
    select 1 from ${authIdentitiesTable}
     where ${authIdentitiesTable.userId} = ${usersTable.id}
       and ${inArray(authIdentitiesTable.provider, [...OIDC_AUTH_PROVIDERS])}
  )`;

  return {
    async findByRef({ ref }) {
      if (!UUID_PATTERN.test(ref)) return undefined;
      const [row] = await database.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, ref)).limit(1);
      return row?.id;
    },

    async findByEmail({ email }) {
      const [row] = await database
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(sql`lower(${usersTable.email}) = ${email.toLowerCase()}`, verifiedEmail))
        .limit(1);
      return row?.id;
    },

    async findEmailByRef({ ref }) {
      if (!UUID_PATTERN.test(ref)) return undefined;
      const [row] = await database
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(and(eq(usersTable.id, ref), verifiedEmail))
        .limit(1);
      return row?.email;
    },
  };
}
