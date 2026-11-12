/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { API_VERSION_PREFIX } from '../shared/http/http.constant';

export const BILLING_PLANS_PATH = `${API_VERSION_PREFIX}/billing/plans`;
export const BILLING_MINE_PATH = `${API_VERSION_PREFIX}/me/subscription`;
/** Publica (o provedor nao tem sessao de pai); quem autentica e' o provedor, pelo segredo dele. */
export const BILLING_WEBHOOK_PATH = `${API_VERSION_PREFIX}/billing/webhooks/:provider`;

/** Corpo de webhook maior que isto nao e' da Hotmart: recusa antes de ler. */
export const BILLING_WEBHOOK_MAX_BYTES = 256 * 1024;

export const PAYMENT_PROVIDER_NAMES = ['hotmart', 'fake'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDER_NAMES)[number];
