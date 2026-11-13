/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Assinaturas para a equipe: quantos pagam, em que situacao, e o que chegou
 * do provedor. Valores em centavos.
 */

import { sql } from 'drizzle-orm';

import type { PaymentModule } from '@adatechnology/payment-module';

import type { Database } from '../../database/client';

export type PanelBillingOverview = {
  readonly byStatus: Readonly<Record<string, number>>;
  readonly byPlan: readonly { readonly planCode: string; readonly count: number }[];
  /** Pagamentos aprovados nos ultimos 30 dias, por moeda. */
  readonly revenue30d: readonly { readonly currency: string; readonly cents: number; readonly payments: number }[];
  readonly unlinked: number;
};

export type PanelSubscriptionRow = {
  readonly id: string;
  readonly provider: string;
  readonly planCode: string;
  readonly status: string;
  readonly periodEndsAt: string | null;
  readonly lastEventAt: string;
  readonly customerEmail: string | null;
  readonly user: { readonly id: string; readonly name: string | null; readonly email: string } | null;
};

export type PanelPaymentEventRow = {
  readonly id: string;
  readonly provider: string;
  readonly type: string;
  readonly providerEventType: string;
  readonly occurredAt: string;
  readonly customerEmail: string | null;
  readonly amountCents: number | null;
  readonly currency: string | null;
  readonly userId: string | null;
};

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => result as Row[];
const num = (value: unknown): number => Number(value ?? 0);
const iso = (value: unknown): string | null =>
  value === null || value === undefined ? null : new Date(value as string | Date).toISOString();

export function createPanelBillingRepository(database: Database, payments: Pick<PaymentModule, 'useCases'>) {
  return {
    async overview(): Promise<PanelBillingOverview> {
      const overview = await payments.useCases.overview();
      return {
        byStatus: overview.byStatus,
        byPlan: overview.withAccessByPlan,
        revenue30d: overview.revenue30d,
        unlinked: overview.unlinked,
      };
    },

    async listSubscriptions(params: {
      readonly page: number;
      readonly perPage: number;
      readonly status?: string | undefined;
      readonly search?: string | undefined;
    }): Promise<{ readonly rows: readonly PanelSubscriptionRow[]; readonly total: number }> {
      const offset = (params.page - 1) * params.perPage;
      const statusFilter = params.status ? sql`and s.status = ${params.status}` : sql``;
      const like = params.search ? `%${params.search.toLowerCase()}%` : undefined;
      const searchFilter = like
        ? sql`and (lower(coalesce(s.customer_email, '')) like ${like} or lower(coalesce(s.customer_name, '')) like ${like} or lower(coalesce(u.email, '')) like ${like} or lower(coalesce(u.full_name, '')) like ${like})`
        : sql``;
      const [rows, total] = await Promise.all([
        database.execute(sql`
          select s.id, s.provider, s.plan_code, s.status, s.period_ends_at, s.last_event_at, s.customer_email,
                 u.id as user_id, u.full_name, u.email as user_email
            from payment.subscriptions s left join users u on u.id::text = s.customer_ref
           where true ${statusFilter} ${searchFilter}
           order by s.last_event_at desc
           limit ${params.perPage} offset ${offset}
        `),
        database.execute(sql`
          select count(*)::int as count from payment.subscriptions s left join users u on u.id::text = s.customer_ref
           where true ${statusFilter} ${searchFilter}
        `),
      ]);
      return {
        rows: rowsOf(rows).map((row) => ({
          id: String(row['id']),
          provider: String(row['provider']),
          planCode: String(row['plan_code']),
          status: String(row['status']),
          periodEndsAt: iso(row['period_ends_at']),
          lastEventAt: iso(row['last_event_at']) ?? '',
          customerEmail: (row['customer_email'] as string | null) ?? null,
          user: row['user_id']
            ? { id: String(row['user_id']), name: (row['full_name'] as string | null) ?? null, email: String(row['user_email']) }
            : null,
        })),
        total: num(rowsOf(total)[0]?.['count']),
      };
    },

    async listEvents(params: {
      readonly page: number;
      readonly perPage: number;
    }): Promise<{ readonly rows: readonly PanelPaymentEventRow[]; readonly total: number }> {
      const offset = (params.page - 1) * params.perPage;
      const [rows, total] = await Promise.all([
        database.execute(sql`
          select id, provider, type, provider_event_type, occurred_at, customer_email, amount_cents, currency, customer_ref as user_id
            from payment.payment_events order by occurred_at desc limit ${params.perPage} offset ${offset}
        `),
        database.execute(sql`select count(*)::int as count from payment.payment_events`),
      ]);
      return {
        rows: rowsOf(rows).map((row) => ({
          id: String(row['id']),
          provider: String(row['provider']),
          type: String(row['type']),
          providerEventType: String(row['provider_event_type']),
          occurredAt: iso(row['occurred_at']) ?? '',
          customerEmail: (row['customer_email'] as string | null) ?? null,
          amountCents: row['amount_cents'] === null || row['amount_cents'] === undefined ? null : num(row['amount_cents']),
          currency: (row['currency'] as string | null) ?? null,
          userId: (row['user_id'] as string | null) ?? null,
        })),
        total: num(rowsOf(total)[0]?.['count']),
      };
    },
  };
}

export type PanelBillingRepository = ReturnType<typeof createPanelBillingRepository>;
