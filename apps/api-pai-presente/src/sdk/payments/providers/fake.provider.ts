/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Provedor de mentira, para teste e desenvolvimento: nao fala com ninguem e
 * nao cobra nada. O "webhook" dele e' o proprio `PaymentEvent` em JSON, com
 * um segredo no cabecalho para o mesmo caminho de recusa ser exercitado.
 */

import { PAYMENT_EVENT_TYPES } from '../payments.constant';
import { PaymentWebhookInvalidError, PaymentWebhookUnauthorizedError } from '../payments.error';
import type { PaymentEvent, PaymentProvider } from '../payments.types';

export const FAKE_PROVIDER_NAME = 'fake';
export const FAKE_SECRET_HEADER = 'x-fake-payment-secret';
export const FAKE_CHECKOUT_BASE_URL = 'https://pagamento.invalid/checkout';

const EVENT_TYPE_VALUES = new Set<string>(Object.values(PAYMENT_EVENT_TYPES));

/** Corpo do webhook falso: datas em ISO, o resto opcional. */
export type FakeWebhookBody = Partial<Omit<PaymentEvent, 'provider' | 'occurredAt' | 'periodEndsAt'>> & {
  readonly eventId: string;
  readonly type: PaymentEvent['type'];
  readonly occurredAt?: string;
  readonly periodEndsAt?: string | null;
};

export function createFakePaymentProvider(config: { readonly secret: string }): PaymentProvider {
  return {
    name: FAKE_PROVIDER_NAME,
    isConfigured: () => config.secret.length > 0,
    async parseWebhook({ headers, rawBody }) {
      if (headers.get(FAKE_SECRET_HEADER) !== config.secret) throw new PaymentWebhookUnauthorizedError(FAKE_PROVIDER_NAME);
      let body: FakeWebhookBody;
      try {
        body = JSON.parse(rawBody) as FakeWebhookBody;
      } catch {
        throw new PaymentWebhookInvalidError(FAKE_PROVIDER_NAME, 'corpo nao e JSON');
      }
      if (typeof body.eventId !== 'string' || !EVENT_TYPE_VALUES.has(body.type)) {
        throw new PaymentWebhookInvalidError(FAKE_PROVIDER_NAME, 'faltam eventId ou type');
      }
      return {
        provider: FAKE_PROVIDER_NAME,
        eventId: body.eventId,
        type: body.type,
        providerEventType: body.providerEventType ?? body.type,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        subscriptionId: body.subscriptionId ?? null,
        transactionId: body.transactionId ?? null,
        customer: body.customer ?? { email: null, name: null },
        customerRef: body.customerRef ?? null,
        offerCode: body.offerCode ?? null,
        planName: body.planName ?? null,
        amount: body.amount ?? null,
        periodEndsAt: body.periodEndsAt ? new Date(body.periodEndsAt) : null,
      };
    },
    buildCheckoutUrl({ baseUrl, customerRef, email }) {
      const url = new URL(baseUrl);
      url.searchParams.set('ref', customerRef);
      if (email) url.searchParams.set('email', email);
      return url.toString();
    },
    readOfferCode(checkoutUrl) {
      try {
        return new URL(checkoutUrl).searchParams.get('offer');
      } catch {
        return null;
      }
    },
  };
}
