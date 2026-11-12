/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Provedor Hotmart. Recebe o webhook versao 2.0.0 (JSON) e monta o link de
 * checkout com o usuario marcado.
 *
 * - Autenticidade: a Hotmart manda o "hottok" da conta no cabecalho
 *   `X-HOTMART-HOTTOK`. Sem ele igual ao configurado, o webhook e' recusado.
 * - Usuario: o link de checkout leva `xcod=<id do usuario>`, e a Hotmart devolve
 *   em `data.purchase.origin.xcod`. O e-mail do comprador e' o plano B.
 * - Nenhum dado do comprador alem de e-mail e nome sai daqui: endereco, CPF e
 *   telefone que a Hotmart manda ficam no corpo cru, que nao e' guardado.
 */

import { timingSafeEqual } from 'node:crypto';

import { PAYMENT_EVENT_TYPES, type PaymentEventType } from '../payments.constant';
import { PaymentWebhookInvalidError, PaymentWebhookUnauthorizedError } from '../payments.error';
import type { CheckoutLinkParams, PaymentAmount, PaymentEvent, PaymentProvider } from '../payments.types';

export const HOTMART_PROVIDER_NAME = 'hotmart';
export const HOTMART_HOTTOK_HEADER = 'x-hotmart-hottok';

/** Nome do evento na Hotmart -> evento do SDK. O que nao esta aqui vira `IGNORED`. */
export const HOTMART_EVENT_MAP: Readonly<Record<string, PaymentEventType>> = {
  PURCHASE_APPROVED: PAYMENT_EVENT_TYPES.PAYMENT_APPROVED,
  PURCHASE_COMPLETE: PAYMENT_EVENT_TYPES.PAYMENT_APPROVED,
  PURCHASE_BILLET_PRINTED: PAYMENT_EVENT_TYPES.PAYMENT_PENDING,
  PURCHASE_DELAYED: PAYMENT_EVENT_TYPES.PAYMENT_OVERDUE,
  PURCHASE_PROTEST: PAYMENT_EVENT_TYPES.PAYMENT_OVERDUE,
  PURCHASE_CANCELED: PAYMENT_EVENT_TYPES.PAYMENT_FAILED,
  PURCHASE_EXPIRED: PAYMENT_EVENT_TYPES.PAYMENT_FAILED,
  PURCHASE_REFUNDED: PAYMENT_EVENT_TYPES.PAYMENT_REFUNDED,
  PURCHASE_CHARGEBACK: PAYMENT_EVENT_TYPES.PAYMENT_CHARGEBACK,
  SUBSCRIPTION_CANCELLATION: PAYMENT_EVENT_TYPES.SUBSCRIPTION_CANCELED,
  SWITCH_PLAN: PAYMENT_EVENT_TYPES.SUBSCRIPTION_PLAN_CHANGED,
};

export type HotmartProviderConfig = {
  /** O "hottok" da conta (Ferramentas > Webhook na Hotmart). Vazio desliga o provedor. */
  readonly hottok: string;
};

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : undefined;
}

/** Le um caminho `a.b.c` sem estourar no meio. */
function pick(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split('.')) {
    const object = asObject(current);
    if (!object) return undefined;
    current = object[key];
  }
  return current;
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** A Hotmart manda data como milissegundos (numero) ou, as vezes, texto ISO. */
function date(...values: unknown[]): Date | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return new Date(value);
    if (typeof value === 'string' && value.length > 0) {
      const parsed = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function amount(data: unknown): PaymentAmount | null {
  const price = asObject(pick(data, 'purchase.price')) ?? asObject(pick(data, 'purchase.full_price'));
  const value = price?.['value'];
  const currency = text(price?.['currency_value'], price?.['currency_code']);
  if (typeof value !== 'number' || !Number.isFinite(value) || !currency) return null;
  return { cents: Math.round(value * 100), currency: currency.toUpperCase() };
}

/** No SWITCH_PLAN a Hotmart manda a lista de planos e marca o atual. */
function currentPlan(data: unknown): Json | undefined {
  const plans = pick(data, 'plans');
  if (!Array.isArray(plans)) return undefined;
  return plans.map(asObject).find((plan) => plan?.['current'] === true);
}

function sameSecret(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createHotmartProvider(config: HotmartProviderConfig): PaymentProvider {
  const hottok = config.hottok.trim();
  return {
    name: HOTMART_PROVIDER_NAME,
    isConfigured: () => hottok.length > 0,

    async parseWebhook({ headers, rawBody }): Promise<PaymentEvent> {
      const received = headers.get(HOTMART_HOTTOK_HEADER) ?? '';
      if (hottok.length === 0 || !sameSecret(received, hottok)) {
        throw new PaymentWebhookUnauthorizedError(HOTMART_PROVIDER_NAME);
      }
      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new PaymentWebhookInvalidError(HOTMART_PROVIDER_NAME, 'corpo nao e JSON (use o webhook versao 2.0.0)');
      }
      const eventName = text(pick(payload, 'event'));
      const eventId = text(pick(payload, 'id'));
      const data = pick(payload, 'data');
      if (!eventName || !eventId || !asObject(data)) {
        throw new PaymentWebhookInvalidError(HOTMART_PROVIDER_NAME, 'faltam id, event ou data');
      }
      const plan = currentPlan(data);
      const transactionId = text(pick(data, 'purchase.transaction'));
      return {
        provider: HOTMART_PROVIDER_NAME,
        eventId,
        type: HOTMART_EVENT_MAP[eventName] ?? PAYMENT_EVENT_TYPES.IGNORED,
        providerEventType: eventName,
        occurredAt: date(pick(payload, 'creation_date')) ?? new Date(),
        subscriptionId:
          text(
            pick(data, 'subscription.subscriber.code'),
            pick(data, 'subscriber.code'),
            pick(data, 'subscription.subscriber_code'),
          ) ?? transactionId,
        transactionId,
        customer: {
          email: text(pick(data, 'buyer.email'), pick(data, 'subscriber.email'), pick(data, 'subscription.user.email'))?.toLowerCase() ?? null,
          name: text(pick(data, 'buyer.name'), pick(data, 'subscriber.name'), pick(data, 'subscription.user.name')),
        },
        customerRef: text(pick(data, 'purchase.origin.xcod')),
        offerCode: text(pick(data, 'purchase.offer.code'), pick(plan, 'offer.key'), pick(plan, 'offer.code')),
        planName: text(pick(data, 'subscription.plan.name'), pick(data, 'plan.name'), pick(plan, 'name')),
        amount: amount(data),
        periodEndsAt: date(pick(data, 'purchase.date_next_charge'), pick(data, 'subscription.date_next_charge')),
      };
    },

    buildCheckoutUrl({ baseUrl, customerRef, email, name }: CheckoutLinkParams): string {
      const url = new URL(baseUrl);
      url.searchParams.set('xcod', customerRef);
      if (email) url.searchParams.set('email', email);
      if (name) url.searchParams.set('name', name);
      return url.toString();
    },

    readOfferCode(checkoutUrl) {
      try {
        return new URL(checkoutUrl).searchParams.get('off');
      } catch {
        return null;
      }
    },
  };
}
