/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { sql } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { usersTable } from '../User/user.table';
import { buildIdentityColumns } from '../shared/columns.constant';
import { DOMAIN_VALUE_LENGTH, MEDIUM_TEXT_LENGTH, SHORT_TEXT_LENGTH } from '../shared/shared.constant';

/**
 * Uma linha por assinatura no provedor. `user_id` pode ser nulo: quem paga
 * pela Hotmart com e-mail diferente do cadastro, ou antes de criar a conta,
 * fica sem dono ate entrar no app com aquele e-mail (`claimByEmail`).
 *
 * Apagar a conta solta a linha (`set null`): a cobranca existiu e a nota
 * fiscal do provedor continua apontando para ela.
 */
export const subscriptionsTable = pgTable(
  'subscriptions',
  {
    ...buildIdentityColumns(),
    userId: uuid('user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    provider: varchar('provider', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    /** Id da assinatura no provedor (na Hotmart, o codigo do assinante). */
    externalId: varchar('external_id', { length: SHORT_TEXT_LENGTH }).notNull(),
    customerEmail: varchar('customer_email', { length: MEDIUM_TEXT_LENGTH }),
    planCode: varchar('plan_code', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    offerCode: varchar('offer_code', { length: SHORT_TEXT_LENGTH }),
    status: varchar('status', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    /** Ate quando o ultimo pagamento cobre. Nulo quando o provedor nao informa. */
    periodEndsAt: timestamp('period_ends_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    /** Data do ultimo evento aplicado: evento mais velho que isto nao muda nada. */
    lastEventAt: timestamp('last_event_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('subscriptions_provider_external_id_key').on(table.provider, table.externalId),
    index('subscriptions_user_id_idx').on(table.userId),
    index('subscriptions_customer_email_idx').on(sql`lower(${table.customerEmail})`),
    index('subscriptions_status_idx').on(table.status),
  ],
);

/**
 * Cada webhook recebido, uma vez so (a chave e' o id do evento no provedor, que
 * reenvia). Guarda so o que foi traduzido: o corpo cru da Hotmart traz CPF,
 * telefone e endereco do comprador, e nada disso e' necessario aqui.
 */
export const paymentEventsTable = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    provider: varchar('provider', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    externalId: varchar('external_id', { length: SHORT_TEXT_LENGTH }).notNull(),
    type: varchar('type', { length: DOMAIN_VALUE_LENGTH }).notNull(),
    providerEventType: varchar('provider_event_type', { length: SHORT_TEXT_LENGTH }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptionsTable.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    customerEmail: varchar('customer_email', { length: MEDIUM_TEXT_LENGTH }),
    offerCode: varchar('offer_code', { length: SHORT_TEXT_LENGTH }),
    transactionId: varchar('transaction_id', { length: SHORT_TEXT_LENGTH }),
    amountCents: integer('amount_cents'),
    currency: varchar('currency', { length: 3 }),
  },
  (table) => [
    unique('payment_events_provider_external_id_key').on(table.provider, table.externalId),
    index('payment_events_created_at_idx').on(table.createdAt),
    index('payment_events_subscription_id_idx').on(table.subscriptionId),
  ],
);

export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;
export type PaymentEventRow = typeof paymentEventsTable.$inferSelect;
