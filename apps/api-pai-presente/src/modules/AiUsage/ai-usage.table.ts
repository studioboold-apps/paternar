/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { sql } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { usersTable } from '../User/user.table';
import { DOMAIN_VALUE_LENGTH, SHORT_TEXT_LENGTH } from '../shared/shared.constant';

/**
 * Uma linha por chamada ao provedor de IA, com os tokens que ELE contou. Nada
 * do que foi perguntado ou respondido entra aqui: e' a conta de luz, nao a
 * conversa. O custo e' calculado na hora da chamada, com a tabela de precos de
 * entao, para o historico nao mudar quando o preco mudar.
 *
 * `user_id` vira nulo quando a conta e' apagada: o gasto continua na soma do
 * mes, mas deixa de apontar para alguem.
 */
export const aiUsageTable = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    userId: uuid('user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    task: varchar('task', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    provider: varchar('provider', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    model: varchar('model', { length: SHORT_TEXT_LENGTH }).notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    webSearches: integer('web_searches').notNull().default(0),
    /** Milionesimos de dolar: inteiro, sem erro de arredondamento na soma. */
    costMicroUsd: integer('cost_micro_usd').notNull().default(0),
  },
  (table) => [
    index('ai_usage_created_at_idx').on(table.createdAt),
    index('ai_usage_user_id_idx').on(table.userId, table.createdAt),
  ],
);

export type AiUsageRow = typeof aiUsageTable.$inferSelect;
export type NewAiUsageRow = typeof aiUsageTable.$inferInsert;
