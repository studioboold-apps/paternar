/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Tudo em memoria e com provedores de mentira: nenhum teste fala com a
 * Hotmart nem cobra ninguem.
 */

import { beforeEach, describe, expect, test } from 'bun:test';

import {
  createFakePaymentProvider,
  createHotmartProvider,
  createPaymentGateway,
  FAKE_SECRET_HEADER,
  HOTMART_HOTTOK_HEADER,
  PAYMENT_EVENT_TYPES,
  type PaymentEvent,
} from '../../sdk/payments';
import {
  createTestClient,
  readData,
  readDataList,
  readDataRecord,
  readErrorCode,
  TEST_USER,
  TEST_USER_ID,
  type TestClient,
} from '../../testing/http-test.util';
import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_METHODS } from '../shared/http/http.constant';
import { BILLING_MINE_PATH, BILLING_PLANS_PATH } from './billing.constant';
import { buildBillingRoutes, buildBillingWebhookRoutes } from './billing.controller';
import { BILLING_FEATURES, buildPlanCatalog } from './billing.plans';
import { createBillingUseCases, type BillingUseCases } from './billing.use-case';
import type { BillingRepository, SubscriptionRecord } from './types/billing.types';

const SECRET = 'segredo-falso';
const HOTTOK = 'hottok-falso';
const MONTHLY = 'https://pagamento.invalid/checkout?offer=mensal';
const YEARLY = 'https://pagamento.invalid/checkout?offer=anual';

function createFakeRepository(knownUsers: Record<string, string>) {
  const events: PaymentEvent[] = [];
  const subscriptions = new Map<string, SubscriptionRecord>();
  let sequence = 0;
  const repository: BillingRepository = {
    async applyEvent({ event, userId, decide }) {
      if (events.some((seen) => seen.provider === event.provider && seen.eventId === event.eventId)) {
        return { outcome: 'duplicate' };
      }
      events.push(event);
      if (!event.subscriptionId) return { outcome: 'recorded', subscription: undefined };
      const key = `${event.provider}:${event.subscriptionId}`;
      const current = subscriptions.get(key);
      const decision = decide(current);
      if (!decision) return { outcome: 'recorded', subscription: current };
      const saved: SubscriptionRecord = {
        id: current?.id ?? `sub-${++sequence}`,
        userId: userId ?? current?.userId ?? null,
        provider: event.provider,
        externalId: event.subscriptionId,
        customerEmail: event.customer.email ?? current?.customerEmail ?? null,
        planCode: decision.planCode,
        offerCode: event.offerCode ?? current?.offerCode ?? null,
        canceledAt: null,
        updatedAt: new Date(),
        ...decision.state,
      };
      subscriptions.set(key, saved);
      return { outcome: 'recorded', subscription: saved };
    },
    async findUserIdById(candidate) {
      return Object.values(knownUsers).includes(candidate) ? candidate : undefined;
    },
    async findUserIdByEmail(email) {
      return knownUsers[email];
    },
    async listForUser({ userId, email }) {
      for (const [key, subscription] of subscriptions) {
        if (subscription.userId === null && subscription.customerEmail === email) {
          subscriptions.set(key, { ...subscription, userId });
        }
      }
      return [...subscriptions.values()]
        .filter((subscription) => subscription.userId === userId)
        .sort((a, b) => b.lastEventAt.getTime() - a.lastEventAt.getTime());
    },
  };
  return { repository, events, subscriptions };
}

let client: TestClient;
let useCases: BillingUseCases;
let store: ReturnType<typeof createFakeRepository>;

beforeEach(() => {
  store = createFakeRepository({ [TEST_USER.email]: TEST_USER_ID });
  useCases = createBillingUseCases({
    repository: store.repository,
    gateway: createPaymentGateway({
      providers: [createFakePaymentProvider({ secret: SECRET }), createHotmartProvider({ hottok: HOTTOK })],
      checkoutProvider: 'fake',
    }),
    plans: buildPlanCatalog({ monthly: MONTHLY, yearly: YEARLY }),
  });
  client = createTestClient({ routes: buildBillingRoutes(useCases), publicRoutes: buildBillingWebhookRoutes(useCases) });
});

const future = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

function sendFake(body: Record<string, unknown>, secret: string = SECRET) {
  return client.send({
    method: HTTP_METHODS.POST,
    path: '/v1/billing/webhooks/fake',
    headers: { [FAKE_SECRET_HEADER]: secret },
    body,
  });
}

describe('plano do pai', () => {
  test('sem assinatura: gratuito, sem recursos pagos', async () => {
    const mine = readDataRecord(await client.send({ method: HTTP_METHODS.GET, path: BILLING_MINE_PATH }));
    expect(mine).toMatchObject({ planCode: 'gratuito', status: 'none', hasAccess: false, features: [] });
  });

  test('os planos vem com o link de checkout marcado para o pai', async () => {
    const plans = readDataList(await client.send({ method: HTTP_METHODS.GET, path: BILLING_PLANS_PATH }));
    expect(plans.map((plan) => plan.code)).toEqual(['gratuito', 'premium_mensal', 'premium_anual']);
    expect(plans[0]).toMatchObject({ checkoutUrl: null, current: true });
    const monthly = new URL(String(plans[1]?.checkoutUrl));
    expect(monthly.searchParams.get('offer')).toBe('mensal');
    expect(monthly.searchParams.get('ref')).toBe(TEST_USER_ID);
  });
});

describe('webhook', () => {
  test('compra aprovada ativa o plano da oferta e libera os recursos', async () => {
    const response = await sendFake({
      eventId: 'e1',
      type: PAYMENT_EVENT_TYPES.PAYMENT_APPROVED,
      subscriptionId: 's1',
      customerRef: TEST_USER_ID,
      offerCode: 'anual',
      periodEndsAt: future(),
    });
    expect(response.status).toBe(200);
    const mine = readDataRecord(await client.send({ method: HTTP_METHODS.GET, path: BILLING_MINE_PATH }));
    expect(mine).toMatchObject({ planCode: 'premium_anual', status: 'active', hasAccess: true });
    expect(await useCases.hasFeature(TEST_USER, BILLING_FEATURES.AI_UNLIMITED)).toBe(true);
  });

  test('o mesmo evento duas vezes conta uma so', async () => {
    const body = { eventId: 'e1', type: PAYMENT_EVENT_TYPES.PAYMENT_APPROVED, subscriptionId: 's1', customerRef: TEST_USER_ID };
    await sendFake(body);
    const again = readDataRecord(await sendFake(body));
    expect(again.duplicate).toBe(true);
    expect(store.events).toHaveLength(1);
  });

  test('reembolso tira o acesso na hora', async () => {
    await sendFake({ eventId: 'e1', type: 'payment_approved', subscriptionId: 's1', customerRef: TEST_USER_ID, occurredAt: '2026-01-01T00:00:00Z' });
    await sendFake({ eventId: 'e2', type: 'payment_refunded', subscriptionId: 's1', occurredAt: '2026-01-02T00:00:00Z' });
    const mine = readDataRecord(await client.send({ method: HTTP_METHODS.GET, path: BILLING_MINE_PATH }));
    expect(mine).toMatchObject({ planCode: 'gratuito', status: 'refunded', hasAccess: false });
    expect(useCases.requireFeature(TEST_USER, BILLING_FEATURES.AI_UNLIMITED)).rejects.toMatchObject({ statusCode: 402 });
  });

  test('cancelada continua valendo ate o fim do periodo pago', async () => {
    await sendFake({ eventId: 'e1', type: 'payment_approved', subscriptionId: 's1', customerRef: TEST_USER_ID, periodEndsAt: future(), occurredAt: '2026-01-01T00:00:00Z' });
    await sendFake({ eventId: 'e2', type: 'subscription_canceled', subscriptionId: 's1', occurredAt: '2026-01-02T00:00:00Z' });
    const mine = readDataRecord(await client.send({ method: HTTP_METHODS.GET, path: BILLING_MINE_PATH }));
    expect(mine).toMatchObject({ status: 'canceled', hasAccess: true, planCode: 'premium_mensal' });
  });

  test('quem pagou com e-mail ainda sem conta ganha a assinatura ao entrar com ele', async () => {
    await sendFake({
      eventId: 'e1',
      type: 'payment_approved',
      subscriptionId: 's1',
      customer: { email: 'novo@example.com', name: null },
      offerCode: 'mensal',
    });
    expect(store.subscriptions.get('fake:s1')?.userId).toBeNull();
    const newcomer = { userId: '55555555-5555-4555-8555-555555555555', email: 'novo@example.com' };
    const mine = await useCases.getMine(newcomer);
    expect(mine).toMatchObject({ planCode: 'premium_mensal', hasAccess: true });
  });

  test('segredo errado: 401, e nada e gravado', async () => {
    const response = await sendFake({ eventId: 'e1', type: 'payment_approved', subscriptionId: 's1' }, 'outro');
    expect(response.status).toBe(401);
    expect(readErrorCode(response)).toBe(ERROR_CODES.billing.WEBHOOK_UNAUTHORIZED);
    expect(store.events).toHaveLength(0);
  });

  test('provedor desconhecido: 404', async () => {
    const response = await client.send({ method: HTTP_METHODS.POST, path: '/v1/billing/webhooks/paypal', body: {} });
    expect(response.status).toBe(404);
    expect(readErrorCode(response)).toBe(ERROR_CODES.billing.PROVIDER_UNKNOWN);
  });

  test('webhook da Hotmart chega pela mesma rota e acha o pai pelo xcod', async () => {
    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: '/v1/billing/webhooks/hotmart',
      headers: { [HOTMART_HOTTOK_HEADER]: HOTTOK },
      body: {
        id: 'hm-1',
        creation_date: Date.now(),
        event: 'PURCHASE_APPROVED',
        data: {
          buyer: { email: 'outro-email@example.com', name: 'Pai' },
          purchase: { transaction: 'HP1', offer: { code: 'nao-mapeada' }, origin: { xcod: TEST_USER_ID } },
          subscription: { subscriber: { code: 'SUB1' } },
        },
      },
    });
    expect(readData(response)).toEqual({ received: true, duplicate: false });
    const mine = readDataRecord(await client.send({ method: HTTP_METHODS.GET, path: BILLING_MINE_PATH }));
    // Oferta que nao bate com nenhum link cai no plano pago padrao: quem pagou nao fica sem acesso.
    expect(mine).toMatchObject({ planCode: 'premium_mensal', hasAccess: true, provider: 'hotmart' });
  });

  test('Hotmart sem hottok configurado: 503', async () => {
    const offline = createBillingUseCases({
      repository: store.repository,
      gateway: createPaymentGateway({ providers: [createHotmartProvider({ hottok: '' })], checkoutProvider: 'hotmart' }),
      plans: buildPlanCatalog({ monthly: '', yearly: '' }),
    });
    const offlineClient = createTestClient({ routes: [], publicRoutes: buildBillingWebhookRoutes(offline) });
    const response = await offlineClient.send({ method: HTTP_METHODS.POST, path: '/v1/billing/webhooks/hotmart', body: {} });
    expect(response.status).toBe(503);
    expect(readErrorCode(response)).toBe(ERROR_CODES.billing.PROVIDER_NOT_CONFIGURED);
  });

  test('a rota do webhook nao pede sessao de pai', async () => {
    const anonymous = createTestClient({ routes: buildBillingRoutes(useCases), publicRoutes: buildBillingWebhookRoutes(useCases), user: undefined });
    const webhook = await anonymous.send({
      method: HTTP_METHODS.POST,
      path: '/v1/billing/webhooks/fake',
      headers: { [FAKE_SECRET_HEADER]: SECRET },
      body: { eventId: 'e1', type: 'ignored' },
    });
    expect(webhook.status).toBe(200);
    const mine = await anonymous.send({ method: HTTP_METHODS.GET, path: BILLING_MINE_PATH });
    expect(mine.status).toBe(401);
  });
});
