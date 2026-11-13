/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { ERROR_CODES } from '../shared/errors/codes';
import { DomainError } from '../shared/errors/app.error';
import type { PlanLevel, PlanLock } from './plan-limits.constant';

/** 402: o pedido e' valido, so' nao cabe no plano. O app mostra o convite para assinar. */
const PAYMENT_REQUIRED = 402;

export class PlanChatLimitReachedError extends DomainError {
  constructor(params: { readonly limit: number; readonly resetsAt: Date }) {
    super({
      code: ERROR_CODES.plan.CHAT_LIMIT_REACHED,
      message: `Voce usou as ${params.limit} conversas desta semana.`,
      statusCode: PAYMENT_REQUIRED,
      details: [
        { field: 'limit', message: String(params.limit) },
        { field: 'resetsAt', message: params.resetsAt.toISOString() },
      ],
    });
  }
}

export class PlanFeatureLockedError extends DomainError {
  constructor(params: { readonly lock: PlanLock; readonly level: PlanLevel }) {
    super({
      code: ERROR_CODES.plan.FEATURE_LOCKED,
      message: 'Este recurso nao esta no seu plano agora.',
      statusCode: PAYMENT_REQUIRED,
      details: [
        { field: 'lock', message: params.lock },
        { field: 'level', message: params.level },
      ],
    });
  }
}
