/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { PaymentProviderNotConfiguredError, PaymentProviderUnknownError } from './payments.error';
import type { IncomingWebhook, PaymentEvent, PaymentProvider } from './payments.types';

export type PaymentGateway = {
  /** Provedor do checkout (o que o app oferece ao pai). */
  readonly checkout: PaymentProvider;
  provider(name: string): PaymentProvider;
  /** Confere e traduz o webhook do provedor pelo nome que veio na rota. */
  receiveWebhook(providerName: string, webhook: IncomingWebhook): Promise<PaymentEvent>;
};

/** Junta os provedores. Mais de um pode receber webhook; um so e' o do checkout. */
export function createPaymentGateway(params: {
  readonly providers: readonly PaymentProvider[];
  readonly checkoutProvider: string;
}): PaymentGateway {
  const byName = new Map(params.providers.map((provider) => [provider.name, provider]));
  function provider(name: string): PaymentProvider {
    const found = byName.get(name);
    if (!found) throw new PaymentProviderUnknownError(name);
    return found;
  }
  return {
    checkout: provider(params.checkoutProvider),
    provider,
    async receiveWebhook(providerName, webhook) {
      const target = provider(providerName);
      if (!target.isConfigured()) throw new PaymentProviderNotConfiguredError(providerName);
      return target.parseWebhook(webhook);
    },
  };
}
