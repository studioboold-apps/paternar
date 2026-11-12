/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import {
  PaymentProviderNotConfiguredError,
  PaymentProviderUnknownError,
  PaymentWebhookInvalidError,
  PaymentWebhookUnauthorizedError,
} from '../../sdk/payments';
import { AppError, DomainError } from '../shared/errors/app.error';
import { ERROR_CODES } from '../shared/errors/codes';

/** 402: o recurso existe, o plano do pai e' que nao libera. */
export class BillingFeatureRequiredError extends DomainError {
  constructor(feature: string) {
    super({
      code: ERROR_CODES.billing.FEATURE_REQUIRED,
      message: `Este recurso faz parte do plano Premium (${feature}).`,
      statusCode: 402,
    });
  }
}

/** Traduz o erro do SDK para HTTP. O que nao e' do SDK segue como esta. */
export function toBillingHttpError(error: unknown): unknown {
  if (error instanceof PaymentProviderUnknownError) {
    return new AppError({ code: ERROR_CODES.billing.PROVIDER_UNKNOWN, message: 'Provedor de pagamento desconhecido.', statusCode: 404 });
  }
  if (error instanceof PaymentProviderNotConfiguredError) {
    return new AppError({
      code: ERROR_CODES.billing.PROVIDER_NOT_CONFIGURED,
      message: 'Provedor de pagamento sem credencial no servidor.',
      statusCode: 503,
    });
  }
  if (error instanceof PaymentWebhookUnauthorizedError) {
    return new AppError({ code: ERROR_CODES.billing.WEBHOOK_UNAUTHORIZED, message: 'Webhook sem credencial valida.', statusCode: 401 });
  }
  if (error instanceof PaymentWebhookInvalidError) {
    return new AppError({ code: ERROR_CODES.billing.WEBHOOK_INVALID, message: error.message, statusCode: 400 });
  }
  return error;
}
