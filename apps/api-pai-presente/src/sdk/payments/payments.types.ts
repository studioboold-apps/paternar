/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { PaymentEventType, SubscriptionStatus } from './payments.constant';

/** O webhook como chegou: o provedor decide se confere token, assinatura ou nada. */
export type IncomingWebhook = {
  readonly headers: Headers;
  readonly rawBody: string;
};

export type PaymentAmount = {
  /** Centavos: inteiro, sem erro de arredondamento na soma. */
  readonly cents: number;
  /** ISO 4217 (BRL, USD...). */
  readonly currency: string;
};

/** Um evento de pagamento ja traduzido para a lingua do SDK. */
export type PaymentEvent = {
  /** Nome do provedor que mandou (`hotmart`, `fake`...). */
  readonly provider: string;
  /** Id do evento no provedor: e' a chave de idempotencia (o provedor reenvia). */
  readonly eventId: string;
  readonly type: PaymentEventType;
  /** Nome cru do evento no provedor, para o historico e para depurar. */
  readonly providerEventType: string;
  readonly occurredAt: Date;
  /**
   * Id estavel da assinatura no provedor. Em compra avulsa (sem recorrencia) e'
   * a transacao: o SDK trata como uma "assinatura" que nao vence.
   */
  readonly subscriptionId: string | null;
  readonly transactionId: string | null;
  readonly customer: { readonly email: string | null; readonly name: string | null };
  /** O que o app mandou no link de checkout para achar o usuario de volta. */
  readonly customerRef: string | null;
  /** Oferta/preco/plano no provedor: o app traduz para o plano dele. */
  readonly offerCode: string | null;
  readonly planName: string | null;
  readonly amount: PaymentAmount | null;
  /** Ate quando o pagamento cobre, quando o provedor informa. */
  readonly periodEndsAt: Date | null;
};

export type CheckoutLinkParams = {
  /** Link de checkout da oferta, como o provedor gera no painel dele. */
  readonly baseUrl: string;
  readonly customerRef: string;
  readonly email?: string | undefined;
  readonly name?: string | undefined;
};

/** O contrato que todo provedor cumpre. */
export type PaymentProvider = {
  readonly name: string;
  /** Falso quando falta credencial: o webhook responde 503 em vez de aceitar qualquer um. */
  isConfigured(): boolean;
  /**
   * Confere que o webhook veio mesmo do provedor e traduz. Lanca
   * `PaymentWebhookUnauthorizedError` ou `PaymentWebhookInvalidError`.
   */
  parseWebhook(webhook: IncomingWebhook): Promise<PaymentEvent>;
  /** Link de checkout com o usuario marcado, para o webhook achar quem pagou. */
  buildCheckoutUrl(params: CheckoutLinkParams): string;
  /** Codigo da oferta dentro de um link de checkout (para mapear oferta -> plano). */
  readOfferCode(checkoutUrl: string): string | null;
};

/** A parte da assinatura que o SDK precisa para decidir o proximo estado e o acesso. */
export type SubscriptionState = {
  readonly status: SubscriptionStatus;
  readonly periodEndsAt: Date | null;
  readonly lastEventAt: Date;
};
