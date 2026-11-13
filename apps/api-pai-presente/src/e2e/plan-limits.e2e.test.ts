/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Limites do plano contra o banco de verdade: a assinatura vem do provedor
 * falso, o gasto de IA e' gravado direto em `ai_usage` (nada chama IA).
 *
 * Roda com `PP_E2E=1` e as migrations aplicadas (`make migrate`).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { FAKE_PAYMENT_SECRET_HEADER } from '@adatechnology/payment-module/testing';

import { createDatabaseClient, type Database } from '../database/client';
import { aiUsageTable } from '../modules/AiUsage/ai-usage.table';
import { buildBillingModule, type BillingModule } from '../modules/Billing/billing.module';
import { BILLING_FEATURES } from '../modules/Billing/billing.plans';
import { childrenTable } from '../modules/Child/child.table';
import { DEFAULT_PLAN_LIMITS, PLAN_LEVELS, SPEND_WINDOW_MS } from '../modules/PlanLimits/plan-limits.constant';
import { PlanChatLimitReachedError, PlanFeatureLockedError } from '../modules/PlanLimits/plan-limits.error';
import type { PlanGate } from '../modules/PlanLimits/plan-limits.gate';
import { buildPlanGate } from '../modules/PlanLimits/plan-limits.module';
import { createPlanLimitsRepository, type PlanLimitsConfig } from '../modules/PlanLimits/plan-limits.repository';
import { usersTable } from '../modules/User/user.table';

const IS_ENABLED = Bun.env.PP_E2E === '1' && Boolean(Bun.env.DATABASE_URL);
const RUN_ID = randomUUID().slice(0, 8);
const SECRET = 'segredo-falso-de-teste';
const FREE_ID = randomUUID();
const SUBSCRIBER_ID = randomUUID();

describe.skipIf(!IS_ENABLED)('limites do plano (e2e com banco)', () => {
  let database: Database;
  let billing: BillingModule;
  let gate: PlanGate;
  let previous: PlanLimitsConfig;
  const repository = () => createPlanLimitsRepository(database);

  async function spend(userId: string, task: string, costMicroUsd: number, times = 1) {
    await database.insert(aiUsageTable).values(
      Array.from({ length: times }, () => ({ userId, task, provider: 'fake', model: 'claude-haiku-5-5', costMicroUsd })),
    );
  }

  beforeAll(async () => {
    database = createDatabaseClient(Bun.env.DATABASE_URL ?? '');
    await database.insert(usersTable).values([
      { id: FREE_ID, email: `livre-${RUN_ID}@teste.dev`, fullName: 'Pai Livre' },
      { id: SUBSCRIBER_ID, email: `assina-${RUN_ID}@teste.dev`, fullName: 'Pai Assinante' },
    ]);
    billing = buildBillingModule({
      database,
      config: { hotmart: { hottok: '', checkoutUrls: { monthly: '', yearly: '' } }, fakeSecret: SECRET, isProduction: false },
      authenticatedUserResolver: { resolve: async () => undefined },
    });
    const approved = await billing.router.handle(
      new Request('http://local/v1/payments/webhooks/fake', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [FAKE_PAYMENT_SECRET_HEADER]: SECRET },
        body: JSON.stringify({
          eventId: `pl-${RUN_ID}`,
          type: 'payment_approved',
          occurredAt: new Date().toISOString(),
          subscriptionId: `pl-${RUN_ID}`,
          customerRef: SUBSCRIBER_ID,
          offerCode: 'mensal',
          periodEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        }),
      }),
    );
    expect(approved.status).toBe(200);

    previous = await repository().getSettings();
    gate = buildPlanGate({
      database,
      isSubscriber: (userId) => billing.payments.useCases.hasFeature({ customerRef: userId }, BILLING_FEATURES.AI_UNLIMITED),
    });
  });

  afterAll(async () => {
    const { updatedAt: _at, updatedBy, ...settings } = previous;
    await repository().saveSettings(settings, updatedBy ?? 'e2e');
    await database.execute(sql`delete from payment.payment_events where external_id like ${`%-${RUN_ID}`}`);
    await database.execute(sql`delete from payment.subscriptions where external_id like ${`%-${RUN_ID}`}`);
    for (const id of [FREE_ID, SUBSCRIBER_ID]) {
      await database.execute(sql`delete from ${aiUsageTable} where ${aiUsageTable.userId} = ${id}`);
      await database.execute(sql`delete from ${usersTable} where ${usersTable.id} = ${id}`);
    }
  });

  test('com a chave desligada, nada muda', async () => {
    await repository().saveSettings({ ...DEFAULT_PLAN_LIMITS, enabled: false }, 'e2e');
    await spend(FREE_ID, 'chat', 100, 12);
    expect((await gate.status(FREE_ID)).enabled).toBe(false);
    await gate.assertCanChat({ userId: FREE_ID, hasImages: true });
  });

  test('ligada: o gratuito conta as conversas da semana e trava o segundo filho', async () => {
    await repository().saveSettings({ ...DEFAULT_PLAN_LIMITS, enabled: true }, 'e2e');
    const status = await gate.status(FREE_ID);
    expect(status).toMatchObject({ enabled: true, level: PLAN_LEVELS.FREE, media: false, fullReports: false });
    expect(status.chat.used).toBe(12);
    expect(status.chat.limit).toBe(10);
    await expect(gate.assertCanChat({ userId: FREE_ID, hasImages: false })).rejects.toBeInstanceOf(PlanChatLimitReachedError);

    await gate.assertCanAddChild(FREE_ID);
    await database.insert(childrenTable).values({ userId: FREE_ID, name: 'Filho', age: 6, gender: 'menino' });
    await expect(gate.assertCanAddChild(FREE_ID)).rejects.toBeInstanceOf(PlanFeatureLockedError);
  });

  test('o assinante dentro do orcamento nao sente nada; o painel ve a media e os maiores', async () => {
    await spend(SUBSCRIBER_ID, 'chat', 50_000, 20);
    const status = await gate.status(SUBSCRIBER_ID);
    expect(status).toMatchObject({ level: PLAN_LEVELS.FULL, media: true, fullReports: true, maxChildren: null });
    expect(status.chat.limit).toBeNull();

    const since = new Date(Date.now() - SPEND_WINDOW_MS);
    const pool = await repository().subscriberPoolSince(since);
    expect(pool.subscribers).toBeGreaterThanOrEqual(1);
    expect(pool.spentMicroUsd).toBeGreaterThanOrEqual(1_000_000);
    const top = await repository().topSubscriberSpenders({ since, limit: 50 });
    expect(top.find((row) => row.id === SUBSCRIBER_ID)).toMatchObject({ costMicroUsd: 1_000_000, calls: 20 });
    // Quem nao assina nao entra na conta dos assinantes.
    expect(top.some((row) => row.id === FREE_ID)).toBe(false);
  });

  test('o teto individual de seguranca: economia e depois o limite do gratuito', async () => {
    await repository().saveSettings(
      { ...DEFAULT_PLAN_LIMITS, enabled: true, individualCapMicroUsd: 1_200_000 },
      'e2e',
    );
    expect((await gate.status(SUBSCRIBER_ID)).level).toBe(PLAN_LEVELS.ECONOMY);
    await spend(SUBSCRIBER_ID, 'report', 300_000);
    const limited = await gate.status(SUBSCRIBER_ID);
    expect(limited.level).toBe(PLAN_LEVELS.LIMITED);
    await expect(gate.assertCanChat({ userId: SUBSCRIBER_ID, hasImages: false })).rejects.toBeInstanceOf(
      PlanChatLimitReachedError,
    );
  });
});
