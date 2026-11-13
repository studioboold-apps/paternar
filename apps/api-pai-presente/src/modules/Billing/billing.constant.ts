/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

/**
 * As rotas vem prontas do `@adatechnology/payment-module`, montadas em `/v1`:
 * - `POST /v1/payments/webhooks/:provider` (publica; quem autentica e' o provedor);
 * - `GET /v1/payments/plans` e `GET /v1/payments/me` (pai logado).
 */
export const PAYMENTS_ROUTE_PREFIX = '/payments';

/** Oferta do provedor falso (so fora de producao). */
export const FAKE_OFFER_CODES = { MONTHLY: 'mensal', YEARLY: 'anual' } as const;
export const FAKE_CHECKOUT_BASE_URL = 'https://pagamento.invalid/checkout';

/**
 * Resgate de compra pelo codigo da transacao. O codigo e' o unico segredo, entao
 * as tentativas sao contadas por pai: 10 por hora tira a graca de chutar.
 */
export const CLAIM_OPERATION_ID = 'claimPaymentPurchase';
export const CLAIM_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 * 60 } as const;
