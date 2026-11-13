/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Pagamentos e assinaturas vem da lib (`@adatechnology/payment-module`). Aqui
 * so mora o que e' do Entrelacos: o catalogo, quais provedores entram e como
 * achar o pai que pagou.
 *
 * O provedor falso nunca e' montado em producao: ninguem ativa assinatura de
 * graca com um POST.
 */

import type { ModuleRoute } from '@adatechnology/module-http';
import { createModuleFetchRouter, type ModuleFetchRouter } from '@adatechnology/module-http/fetch';
import { createHotmartPaymentProvider } from '@adatechnology/hotmart-payment-provider';
import type { PaymentProviderPort } from '@adatechnology/payment-contracts';
import { createPaymentModule, createPaymentRoutes, type PaymentModule } from '@adatechnology/payment-module';
import { createFakePaymentProvider } from '@adatechnology/payment-module/testing';

import type { Database } from '../../database/client';
import { createAppAuthResolver } from '../Recommendation/recommendation.module';
import type { AuthenticatedUserResolver } from '../shared/auth/authenticated-user.interface';
import { API_VERSION_PREFIX } from '../shared/http/http.constant';
import { createRateLimiter, type RateLimiter } from '../shared/http/rate-limit';
import type { Logger } from '../shared/logger/logger';
import { CLAIM_OPERATION_ID, CLAIM_RATE_LIMIT, FAKE_OFFER_CODES, PAYMENTS_ROUTE_PREFIX } from './billing.constant';
import { createBillingCustomerResolver } from './billing.customers';
import { buildPlanCatalog, FALLBACK_PAID_PLAN_CODE } from './billing.plans';

export type BillingConfig = {
  readonly hotmart: {
    readonly hottok: string;
    readonly checkoutUrls: { readonly monthly: string; readonly yearly: string };
  };
  /** Segredo do provedor falso (desenvolvimento). Vazio desliga. */
  readonly fakeSecret: string;
  readonly isProduction: boolean;
};

export type BillingModule = {
  readonly payments: PaymentModule;
  readonly router: ModuleFetchRouter;
};

export function buildBillingModule(params: {
  readonly database: Database;
  readonly config: BillingConfig;
  readonly authenticatedUserResolver: AuthenticatedUserResolver;
  readonly logger?: Logger | undefined;
}): BillingModule {
  const { config } = params;
  const withFake = !config.isProduction && config.fakeSecret.length > 0;
  const providers: PaymentProviderPort[] = [createHotmartPaymentProvider({ hottok: config.hotmart.hottok })];
  if (withFake) providers.push(createFakePaymentProvider({ secret: config.fakeSecret }));

  const customers = createBillingCustomerResolver(params.database);
  const payments = createPaymentModule({
    // drizzle 0.44 aqui, 1.x na lib: o query builder usado e' o mesmo.
    db: params.database as never,
    config: {
      plans: buildPlanCatalog({
        monthly: {
          hotmartCheckoutUrl: config.hotmart.checkoutUrls.monthly,
          fakeOfferCode: withFake ? FAKE_OFFER_CODES.MONTHLY : undefined,
        },
        yearly: {
          hotmartCheckoutUrl: config.hotmart.checkoutUrls.yearly,
          fakeOfferCode: withFake ? FAKE_OFFER_CODES.YEARLY : undefined,
        },
      }),
      fallbackPlanCode: FALLBACK_PAID_PLAN_CODE,
    },
    providers,
    customers,
    ...(params.logger ? { logger: params.logger } : {}),
  });

  const routes = createPaymentRoutes({
    module: payments,
    prefix: PAYMENTS_ROUTE_PREFIX,
    // O painel tem login proprio e le pelo `useCases`; o app nao publica rota de admin.
    features: { admin: false },
    // O e-mail que vai daqui tambem amarra compra feita sem conta. Por isso so o
    // confirmado (Google/Apple), e nunca o da sessao direto: ver billing.customers.ts.
    async identify(context) {
      const userId = context.auth?.userId;
      const email = userId ? await customers.findEmailByRef?.({ ref: userId }) : undefined;
      // Confirmado: serve para o checkout E para amarrar compra feita antes da conta.
      return email ? { email, verifiedEmail: email } : {};
    },
  });

  return {
    payments,
    router: createModuleFetchRouter({
      authResolver: createAppAuthResolver(params.authenticatedUserResolver),
      basePath: API_VERSION_PREFIX,
      routes: withClaimRateLimit(routes, createRateLimiter(CLAIM_RATE_LIMIT)),
    }),
  };
}

/** Resgate pelo codigo conta tentativas por pai (429 ao passar do limite). */
export function withClaimRateLimit(routes: readonly ModuleRoute[], limiter: RateLimiter): ModuleRoute[] {
  return routes.map((route) =>
    route.operationId === CLAIM_OPERATION_ID
      ? {
          ...route,
          async handler(context) {
            limiter.consume(context.auth?.userId ?? 'anonimo');
            return route.handler(context);
          },
        }
      : route,
  );
}
