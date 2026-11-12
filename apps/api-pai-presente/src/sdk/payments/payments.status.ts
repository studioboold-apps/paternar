/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A maquina de estados da assinatura. Pura: o mesmo evento sobre o mesmo
 * estado da sempre o mesmo resultado, seja qual for o provedor.
 */

import {
  PAYMENT_EVENT_TYPES,
  SUBSCRIPTION_STATUSES,
  type PaymentEventType,
  type SubscriptionStatus,
} from './payments.constant';
import type { PaymentEvent, SubscriptionState } from './payments.types';

/** Quanto tempo o atraso de renovacao ainda deixa usar, contado do fim do periodo. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function nextSubscriptionStatus(
  current: SubscriptionStatus | undefined,
  type: PaymentEventType,
): SubscriptionStatus | undefined {
  switch (type) {
    case PAYMENT_EVENT_TYPES.PAYMENT_APPROVED:
      return SUBSCRIPTION_STATUSES.ACTIVE;
    case PAYMENT_EVENT_TYPES.PAYMENT_PENDING:
      return current ?? SUBSCRIPTION_STATUSES.PENDING;
    case PAYMENT_EVENT_TYPES.PAYMENT_OVERDUE:
      return SUBSCRIPTION_STATUSES.PAST_DUE;
    case PAYMENT_EVENT_TYPES.PAYMENT_FAILED:
      // Renovacao que nao passou: atrasada, nao cancelada (o provedor avisa o cancelamento a parte).
      return current === SUBSCRIPTION_STATUSES.ACTIVE || current === SUBSCRIPTION_STATUSES.PAST_DUE
        ? SUBSCRIPTION_STATUSES.PAST_DUE
        : SUBSCRIPTION_STATUSES.CANCELED;
    case PAYMENT_EVENT_TYPES.PAYMENT_REFUNDED:
    case PAYMENT_EVENT_TYPES.PAYMENT_CHARGEBACK:
      return SUBSCRIPTION_STATUSES.REFUNDED;
    case PAYMENT_EVENT_TYPES.SUBSCRIPTION_CANCELED:
      return current === SUBSCRIPTION_STATUSES.REFUNDED ? current : SUBSCRIPTION_STATUSES.CANCELED;
    case PAYMENT_EVENT_TYPES.SUBSCRIPTION_PLAN_CHANGED:
      return current ?? SUBSCRIPTION_STATUSES.ACTIVE;
    case PAYMENT_EVENT_TYPES.IGNORED:
      return current;
  }
}

/**
 * Aplica o evento no estado. Evento mais velho que o ultimo aplicado nao muda
 * nada: o provedor reenvia e entrega fora de ordem, e um "aprovado" atrasado
 * nao pode desfazer um reembolso que ja chegou.
 */
export function applyPaymentEvent(
  current: SubscriptionState | undefined,
  event: Pick<PaymentEvent, 'type' | 'occurredAt' | 'periodEndsAt'>,
): SubscriptionState | undefined {
  if (current && event.occurredAt < current.lastEventAt) return current;
  const status = nextSubscriptionStatus(current?.status, event.type);
  if (status === undefined) return undefined;
  return {
    status,
    periodEndsAt: event.periodEndsAt ?? current?.periodEndsAt ?? null,
    lastEventAt: event.occurredAt,
  };
}

/** Quem pode usar o que o plano libera, agora. */
export function subscriptionGrantsAccess(
  state: Pick<SubscriptionState, 'status' | 'periodEndsAt'>,
  now: Date = new Date(),
): boolean {
  switch (state.status) {
    case SUBSCRIPTION_STATUSES.ACTIVE:
      return true;
    case SUBSCRIPTION_STATUSES.PAST_DUE:
      return state.periodEndsAt === null || now.getTime() < state.periodEndsAt.getTime() + PAST_DUE_GRACE_MS;
    case SUBSCRIPTION_STATUSES.CANCELED:
      return state.periodEndsAt !== null && now < state.periodEndsAt;
    case SUBSCRIPTION_STATUSES.PENDING:
    case SUBSCRIPTION_STATUSES.REFUNDED:
      return false;
  }
}
