/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Corpos no formato do webhook 2.0.0 da Hotmart, escritos a mao: nenhum teste
 * fala com a Hotmart.
 */

import { describe, expect, test } from 'bun:test';

import { PAYMENT_EVENT_TYPES } from '../payments.constant';
import { PaymentWebhookInvalidError, PaymentWebhookUnauthorizedError } from '../payments.error';
import { createHotmartProvider, HOTMART_HOTTOK_HEADER } from './hotmart.provider';

const HOTTOK = 'hottok-de-teste';
const provider = createHotmartProvider({ hottok: HOTTOK });

function webhook(body: unknown, hottok: string = HOTTOK) {
  return { headers: new Headers({ [HOTMART_HOTTOK_HEADER]: hottok }), rawBody: JSON.stringify(body) };
}

const APPROVED = {
  id: 'evt-1',
  creation_date: 1_767_225_600_000,
  event: 'PURCHASE_APPROVED',
  version: '2.0.0',
  data: {
    product: { id: 123, name: 'Entrelaços Premium' },
    buyer: { email: 'Pai@Example.com', name: 'Pai Teste', document: '00000000000' },
    purchase: {
      transaction: 'HP123',
      status: 'APPROVED',
      price: { value: 19.9, currency_value: 'BRL' },
      offer: { code: 'mensal01' },
      origin: { xcod: '11111111-1111-4111-8111-111111111111' },
      date_next_charge: 1_769_904_000_000,
    },
    subscription: { status: 'ACTIVE', plan: { id: 9, name: 'Mensal' }, subscriber: { code: 'SUB1' } },
  },
};

describe('webhook da Hotmart', () => {
  test('compra aprovada vira pagamento aprovado, com usuario, oferta, valor e vencimento', async () => {
    const event = await provider.parseWebhook(webhook(APPROVED));
    expect(event).toMatchObject({
      provider: 'hotmart',
      eventId: 'evt-1',
      type: PAYMENT_EVENT_TYPES.PAYMENT_APPROVED,
      providerEventType: 'PURCHASE_APPROVED',
      subscriptionId: 'SUB1',
      transactionId: 'HP123',
      customer: { email: 'pai@example.com', name: 'Pai Teste' },
      customerRef: '11111111-1111-4111-8111-111111111111',
      offerCode: 'mensal01',
      planName: 'Mensal',
      amount: { cents: 1990, currency: 'BRL' },
    });
    expect(event.occurredAt.getTime()).toBe(1_767_225_600_000);
    expect(event.periodEndsAt?.getTime()).toBe(1_769_904_000_000);
  });

  test('o CPF do comprador nao sai do provedor', async () => {
    const event = await provider.parseWebhook(webhook(APPROVED));
    expect(JSON.stringify(event)).not.toContain('00000000000');
  });

  test('cancelamento de assinatura usa o assinante do corpo de cancelamento', async () => {
    const event = await provider.parseWebhook(
      webhook({
        id: 'evt-2',
        creation_date: 1_767_225_700_000,
        event: 'SUBSCRIPTION_CANCELLATION',
        data: { subscriber: { code: 'SUB1', email: 'pai@example.com', name: 'Pai' }, plan: { name: 'Mensal' } },
      }),
    );
    expect(event.type).toBe(PAYMENT_EVENT_TYPES.SUBSCRIPTION_CANCELED);
    expect(event.subscriptionId).toBe('SUB1');
    expect(event.customer.email).toBe('pai@example.com');
  });

  test('troca de plano pega o plano marcado como atual', async () => {
    const event = await provider.parseWebhook(
      webhook({
        id: 'evt-3',
        event: 'SWITCH_PLAN',
        data: {
          subscription: { subscriber_code: 'SUB1', user: { email: 'pai@example.com' } },
          plans: [
            { name: 'Mensal', current: false, offer: { key: 'mensal01' } },
            { name: 'Anual', current: true, offer: { key: 'anual01' } },
          ],
        },
      }),
    );
    expect(event).toMatchObject({ type: PAYMENT_EVENT_TYPES.SUBSCRIPTION_PLAN_CHANGED, subscriptionId: 'SUB1', offerCode: 'anual01', planName: 'Anual' });
  });

  test('compra avulsa usa a transacao como id da assinatura', async () => {
    const { subscription: _ignored, ...data } = APPROVED.data;
    const event = await provider.parseWebhook(webhook({ ...APPROVED, data }));
    expect(event.subscriptionId).toBe('HP123');
  });

  test('evento que nao muda assinatura e aceito como ignorado', async () => {
    const event = await provider.parseWebhook(webhook({ ...APPROVED, event: 'PURCHASE_OUT_OF_SHOPPING_CART' }));
    expect(event.type).toBe(PAYMENT_EVENT_TYPES.IGNORED);
  });

  test('hottok errado ou ausente e recusado', async () => {
    expect(provider.parseWebhook(webhook(APPROVED, 'outro'))).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError);
    expect(
      provider.parseWebhook({ headers: new Headers(), rawBody: JSON.stringify(APPROVED) }),
    ).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError);
  });

  test('sem hottok configurado, nada passa', async () => {
    const empty = createHotmartProvider({ hottok: '' });
    expect(empty.isConfigured()).toBe(false);
    expect(empty.parseWebhook(webhook(APPROVED, ''))).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError);
  });

  test('corpo que nao e JSON (webhook 1.0) e invalido', async () => {
    const result = provider.parseWebhook({
      headers: new Headers({ [HOTMART_HOTTOK_HEADER]: HOTTOK }),
      rawBody: 'hottok=x&status=approved',
    });
    expect(result).rejects.toBeInstanceOf(PaymentWebhookInvalidError);
  });
});

describe('checkout da Hotmart', () => {
  const base = 'https://pay.hotmart.com/X12345678Y?off=mensal01';

  test('o link leva o usuario em xcod e o e-mail preenchido, sem perder a oferta', () => {
    const url = new URL(provider.buildCheckoutUrl({ baseUrl: base, customerRef: 'user-1', email: 'pai@example.com' }));
    expect(url.searchParams.get('off')).toBe('mensal01');
    expect(url.searchParams.get('xcod')).toBe('user-1');
    expect(url.searchParams.get('email')).toBe('pai@example.com');
  });

  test('le o codigo da oferta do link', () => {
    expect(provider.readOfferCode(base)).toBe('mensal01');
    expect(provider.readOfferCode('nao e link')).toBeNull();
  });
});
