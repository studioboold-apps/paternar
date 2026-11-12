/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Erros do SDK, sem depender do app: o app traduz para HTTP.
 */

export class PaymentWebhookUnauthorizedError extends Error {
  constructor(provider: string) {
    super(`webhook de ${provider} sem credencial valida`);
    this.name = 'PaymentWebhookUnauthorizedError';
  }
}

export class PaymentWebhookInvalidError extends Error {
  constructor(provider: string, reason: string) {
    super(`webhook de ${provider} invalido: ${reason}`);
    this.name = 'PaymentWebhookInvalidError';
  }
}

export class PaymentProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`provedor de pagamento ${provider} sem credencial`);
    this.name = 'PaymentProviderNotConfiguredError';
  }
}

export class PaymentProviderUnknownError extends Error {
  constructor(provider: string) {
    super(`provedor de pagamento desconhecido: ${provider}`);
    this.name = 'PaymentProviderUnknownError';
  }
}
