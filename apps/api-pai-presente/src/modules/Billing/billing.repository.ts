/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../../database/client';
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from '../../sdk/payments';
import { usersTable } from '../User/user.table';
import { paymentEventsTable, subscriptionsTable, type SubscriptionRow } from './billing.table';
import type { BillingRepository, SubscriptionRecord } from './types/billing.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    externalId: row.externalId,
    customerEmail: row.customerEmail,
    planCode: row.planCode,
    offerCode: row.offerCode,
    status: row.status as SubscriptionStatus,
    periodEndsAt: row.periodEndsAt,
    canceledAt: row.canceledAt,
    lastEventAt: row.lastEventAt,
    updatedAt: row.updatedAt,
  };
}

export function createBillingRepository(database: Database): BillingRepository {
  return {
    async applyEvent({ event, userId, decide }) {
      return database.transaction(async (transaction) => {
        const inserted = await transaction
          .insert(paymentEventsTable)
          .values({
            provider: event.provider,
            externalId: event.eventId,
            type: event.type,
            providerEventType: event.providerEventType,
            occurredAt: event.occurredAt,
            userId,
            customerEmail: event.customer.email,
            offerCode: event.offerCode,
            transactionId: event.transactionId,
            amountCents: event.amount?.cents ?? null,
            currency: event.amount?.currency ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: paymentEventsTable.id });
        const eventRowId = inserted[0]?.id;
        if (eventRowId === undefined) return { outcome: 'duplicate' as const };
        if (!event.subscriptionId) return { outcome: 'recorded' as const, subscription: undefined };

        const found = await transaction
          .select()
          .from(subscriptionsTable)
          .where(and(eq(subscriptionsTable.provider, event.provider), eq(subscriptionsTable.externalId, event.subscriptionId)))
          .for('update')
          .limit(1);
        const current = found[0] ? toRecord(found[0]) : undefined;
        const decision = decide(current);
        if (!decision) {
          if (current) {
            await transaction.update(paymentEventsTable).set({ subscriptionId: current.id }).where(eq(paymentEventsTable.id, eventRowId));
          }
          return { outcome: 'recorded' as const, subscription: current };
        }

        const { status, periodEndsAt, lastEventAt } = decision.state;
        const canceledAt =
          status === SUBSCRIPTION_STATUSES.CANCELED
            ? (current?.canceledAt ?? event.occurredAt)
            : status === SUBSCRIPTION_STATUSES.ACTIVE
              ? null
              : (current?.canceledAt ?? null);
        const values = {
          userId: userId ?? current?.userId ?? null,
          customerEmail: event.customer.email ?? current?.customerEmail ?? null,
          planCode: decision.planCode,
          offerCode: event.offerCode ?? current?.offerCode ?? null,
          status,
          periodEndsAt,
          canceledAt,
          lastEventAt,
          updatedAt: new Date(),
        };
        const [saved] = await transaction
          .insert(subscriptionsTable)
          .values({ provider: event.provider, externalId: event.subscriptionId, ...values })
          .onConflictDoUpdate({
            target: [subscriptionsTable.provider, subscriptionsTable.externalId],
            set: values,
          })
          .returning();
        if (!saved) throw new Error('assinatura nao foi gravada');
        await transaction
          .update(paymentEventsTable)
          .set({ subscriptionId: saved.id, userId: saved.userId })
          .where(eq(paymentEventsTable.id, eventRowId));
        return { outcome: 'recorded' as const, subscription: toRecord(saved) };
      });
    },

    async findUserIdById(candidate) {
      if (!UUID_PATTERN.test(candidate)) return undefined;
      const rows = await database.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, candidate)).limit(1);
      return rows[0]?.id;
    },

    async findUserIdByEmail(email) {
      const rows = await database
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${email.toLowerCase()}`)
        .limit(1);
      return rows[0]?.id;
    },

    async listForUser({ userId, email }) {
      await database
        .update(subscriptionsTable)
        .set({ userId, updatedAt: new Date() })
        .where(and(isNull(subscriptionsTable.userId), sql`lower(${subscriptionsTable.customerEmail}) = ${email.toLowerCase()}`));
      const rows = await database
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId))
        .orderBy(desc(subscriptionsTable.lastEventAt));
      return rows.map(toRecord);
    },
  };
}
