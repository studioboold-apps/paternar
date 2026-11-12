/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { PAYMENT_EVENT_TYPES, SUBSCRIPTION_STATUSES } from './payments.constant';
import { applyPaymentEvent, nextSubscriptionStatus, PAST_DUE_GRACE_MS, subscriptionGrantsAccess } from './payments.status';

const T0 = new Date('2026-01-01T00:00:00Z');
const T1 = new Date('2026-01-02T00:00:00Z');

describe('estado da assinatura', () => {
  test('aprovado ativa; reembolso e chargeback tiram', () => {
    expect(nextSubscriptionStatus(undefined, PAYMENT_EVENT_TYPES.PAYMENT_APPROVED)).toBe(SUBSCRIPTION_STATUSES.ACTIVE);
    expect(nextSubscriptionStatus('active', PAYMENT_EVENT_TYPES.PAYMENT_REFUNDED)).toBe(SUBSCRIPTION_STATUSES.REFUNDED);
    expect(nextSubscriptionStatus('active', PAYMENT_EVENT_TYPES.PAYMENT_CHARGEBACK)).toBe(SUBSCRIPTION_STATUSES.REFUNDED);
  });

  test('renovacao que falha deixa em atraso; primeira compra que falha cancela', () => {
    expect(nextSubscriptionStatus('active', PAYMENT_EVENT_TYPES.PAYMENT_FAILED)).toBe(SUBSCRIPTION_STATUSES.PAST_DUE);
    expect(nextSubscriptionStatus('pending', PAYMENT_EVENT_TYPES.PAYMENT_FAILED)).toBe(SUBSCRIPTION_STATUSES.CANCELED);
  });

  test('evento ignorado sem assinatura nao cria nada', () => {
    expect(applyPaymentEvent(undefined, { type: PAYMENT_EVENT_TYPES.IGNORED, occurredAt: T0, periodEndsAt: null })).toBeUndefined();
  });

  test('evento atrasado nao desfaz o mais novo', () => {
    const refunded = { status: SUBSCRIPTION_STATUSES.REFUNDED, periodEndsAt: null, lastEventAt: T1 };
    const after = applyPaymentEvent(refunded, { type: PAYMENT_EVENT_TYPES.PAYMENT_APPROVED, occurredAt: T0, periodEndsAt: null });
    expect(after).toBe(refunded);
  });

  test('o vencimento fica quando o evento novo nao informa', () => {
    const active = { status: SUBSCRIPTION_STATUSES.ACTIVE, periodEndsAt: T1, lastEventAt: T0 };
    const canceled = applyPaymentEvent(active, { type: PAYMENT_EVENT_TYPES.SUBSCRIPTION_CANCELED, occurredAt: T1, periodEndsAt: null });
    expect(canceled).toEqual({ status: SUBSCRIPTION_STATUSES.CANCELED, periodEndsAt: T1, lastEventAt: T1 });
  });
});

describe('acesso', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  const past = new Date('2026-01-05T00:00:00Z');
  const future = new Date('2026-01-20T00:00:00Z');

  test('ativo usa; pendente e reembolsado nao', () => {
    expect(subscriptionGrantsAccess({ status: 'active', periodEndsAt: null }, now)).toBe(true);
    expect(subscriptionGrantsAccess({ status: 'pending', periodEndsAt: future }, now)).toBe(false);
    expect(subscriptionGrantsAccess({ status: 'refunded', periodEndsAt: future }, now)).toBe(false);
  });

  test('cancelado usa ate o fim do periodo pago', () => {
    expect(subscriptionGrantsAccess({ status: 'canceled', periodEndsAt: future }, now)).toBe(true);
    expect(subscriptionGrantsAccess({ status: 'canceled', periodEndsAt: past }, now)).toBe(false);
    expect(subscriptionGrantsAccess({ status: 'canceled', periodEndsAt: null }, now)).toBe(false);
  });

  test('atrasado usa durante a tolerancia', () => {
    const justExpired = new Date(now.getTime() - PAST_DUE_GRACE_MS + 60_000);
    const longExpired = new Date(now.getTime() - PAST_DUE_GRACE_MS - 60_000);
    expect(subscriptionGrantsAccess({ status: 'past_due', periodEndsAt: justExpired }, now)).toBe(true);
    expect(subscriptionGrantsAccess({ status: 'past_due', periodEndsAt: longExpired }, now)).toBe(false);
  });
});
