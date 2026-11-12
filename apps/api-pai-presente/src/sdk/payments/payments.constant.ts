/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * SDK de pagamentos e assinaturas. Nada aqui conhece o app: nem banco, nem
 * rota, nem usuario. Cada provedor (Hotmart hoje, outro amanha) traduz o
 * webhook dele para os eventos abaixo, e o resto do produto so fala esta lingua.
 * Fica isolado para poder virar pacote proprio sem mexer em quem usa.
 */

/** O que aconteceu, na lingua do SDK. O nome cru do provedor vai junto em `providerEventType`. */
export const PAYMENT_EVENT_TYPES = {
  /** Pagamento aprovado: primeira compra ou renovacao. */
  PAYMENT_APPROVED: 'payment_approved',
  /** Boleto/pix gerado, esperando pagar. */
  PAYMENT_PENDING: 'payment_pending',
  /** Cobranca da renovacao atrasada. */
  PAYMENT_OVERDUE: 'payment_overdue',
  /** Cobranca cancelada ou expirada sem pagar. */
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',
  PAYMENT_CHARGEBACK: 'payment_chargeback',
  /** Assinatura cancelada: nao renova mais. */
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  /** Troca de plano dentro do mesmo produto. */
  SUBSCRIPTION_PLAN_CHANGED: 'subscription_plan_changed',
  /** Evento que o provedor manda e que nao muda assinatura (ex.: carrinho abandonado). */
  IGNORED: 'ignored',
} as const;

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[keyof typeof PAYMENT_EVENT_TYPES];

export const SUBSCRIPTION_STATUSES = {
  /** Comprou e o pagamento ainda nao caiu (boleto/pix). Sem acesso. */
  PENDING: 'pending',
  ACTIVE: 'active',
  /** Renovacao atrasada. Mantem acesso durante a tolerancia. */
  PAST_DUE: 'past_due',
  /** Nao renova mais. Acesso ate o fim do periodo pago. */
  CANCELED: 'canceled',
  /** Reembolso ou chargeback. Sem acesso. */
  REFUNDED: 'refunded',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];

export const SUBSCRIPTION_STATUS_VALUES = Object.values(SUBSCRIPTION_STATUSES);
