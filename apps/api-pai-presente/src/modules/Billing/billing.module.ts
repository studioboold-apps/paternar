/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Pagamentos e assinaturas. O SDK (`src/sdk/payments`) fala com o provedor;
 * este modulo guarda, decide o plano do pai e expoe as rotas.
 */

import type { Database } from '../../database/client';
import {
  createFakePaymentProvider,
  createHotmartProvider,
  createPaymentGateway,
  type PaymentProvider,
} from '../../sdk/payments';
import type { Logger } from '../shared/logger/logger';
import type { PublicRouteDefinition, RouteDefinition } from '../shared/http/route.types';
import type { PaymentProviderName } from './billing.constant';
import { buildBillingRoutes, buildBillingWebhookRoutes } from './billing.controller';
import { buildPlanCatalog, type BillingCheckoutUrls } from './billing.plans';
import { createBillingRepository } from './billing.repository';
import { createBillingUseCases, type BillingUseCases } from './billing.use-case';

export type BillingConfig = {
  /** Provedor do checkout que o app oferece. */
  readonly checkoutProvider: PaymentProviderName;
  readonly hotmart: { readonly hottok: string };
  readonly checkoutUrls: BillingCheckoutUrls;
  /**
   * Segredo do provedor falso (desenvolvimento). Vazio desliga, e em producao
   * ele nunca e' montado: ninguem ativa assinatura de graca por um POST.
   */
  readonly fakeSecret: string;
  readonly isProduction: boolean;
};

export type BillingModule = {
  readonly useCases: BillingUseCases;
  readonly routes: readonly RouteDefinition[];
  readonly publicRoutes: readonly PublicRouteDefinition[];
};

export function buildBillingModule(params: {
  readonly database: Database;
  readonly config: BillingConfig;
  readonly logger?: Logger | undefined;
}): BillingModule {
  const { config } = params;
  const providers: PaymentProvider[] = [createHotmartProvider({ hottok: config.hotmart.hottok })];
  if (!config.isProduction) providers.push(createFakePaymentProvider({ secret: config.fakeSecret }));
  const checkoutProvider = config.isProduction ? 'hotmart' : config.checkoutProvider;
  const useCases = createBillingUseCases({
    repository: createBillingRepository(params.database),
    gateway: createPaymentGateway({ providers, checkoutProvider }),
    plans: buildPlanCatalog(config.checkoutUrls),
    logger: params.logger,
  });
  return {
    useCases,
    routes: buildBillingRoutes(useCases),
    publicRoutes: buildBillingWebhookRoutes(useCases),
  };
}
