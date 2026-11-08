/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { boolean, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { buildIdentityColumns } from '../shared/columns.constant';
import { DOMAIN_VALUE_LENGTH, MEDIUM_TEXT_LENGTH, SHORT_TEXT_LENGTH } from '../shared/shared.constant';

// As tres colunas de orientacao (sexual, religiosa, politica) NAO existem aqui:
// sao dado sensivel da LGPD art. 11 e a permanencia delas e a decisao TL.1.
export const usersTable = pgTable('users', {
  ...buildIdentityColumns(),
  email: varchar('email', { length: MEDIUM_TEXT_LENGTH }).notNull().unique(),
  fullName: varchar('full_name', { length: MEDIUM_TEXT_LENGTH }),
  age: integer('age'),
  maritalStatus: varchar('marital_status', { length: DOMAIN_VALUE_LENGTH }),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  /** Data URL da foto de perfil (ver `avatarDataUrlSchema`). */
  avatarUrl: text('avatar_url'),
  city: varchar('city', { length: SHORT_TEXT_LENGTH }),
  /**
   * Bloqueio feito pela equipe no painel. Preenchido, o pai nao entra, nao
   * renova sessao e o cookie que ainda tiver para de valer. Nulo e' liberado.
   */
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
});

export type UserRow = typeof usersTable.$inferSelect;
export type NewUserRow = typeof usersTable.$inferInsert;
