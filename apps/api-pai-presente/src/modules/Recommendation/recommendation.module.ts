/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Recomendacoes ("Lugares para ir") pelo SDK da casa. Este arquivo monta UMA
 * instancia de cada modulo e expoe duas portas:
 *
 * - o FEED dos pais (`/v1/recommendations`), atras da sessao normal do app;
 * - a ADMINISTRACAO, que o painel monta atras da sessao da equipe.
 *
 * Os anunciantes vivem no `customer-module`, e a recomendacao patrocinada
 * aponta para um deles.
 */

import { createCustomerModule, type CustomerModule } from '@adatechnology/customer-module';
import type { AuthContextResolverPort, ModuleRoute } from '@adatechnology/module-http';
import { createModuleFetchRouter, type ModuleFetchRouter } from '@adatechnology/module-http/fetch';
import {
  createRecommendationModule,
  createRecommendationRoutes,
  type RecommendationModule,
} from '@adatechnology/recommendation-module';

import type { Database } from '../../database/client';
import type { AuthenticatedUserResolver } from '../shared/auth/authenticated-user.interface';
import { API_VERSION_PREFIX } from '../shared/http/http.constant';
import { createRateLimiter, type RateLimiter } from '../shared/http/rate-limit';
import type { Logger } from '../shared/logger/logger';
import { NOTIFICATION_COMPANY_ID } from '../Notification/notification.constant';
import { RECOMMENDATION_CONFIG, RECOMMENDATION_EVENTS_RATE_LIMIT } from './recommendation.constant';

const TRACK_OPERATION_ID = 'trackRecommendationEvent';
/** O feed dos pais e as notificacoes compartilham o UUID da empresa. */
const APP_COMPANY_ID = NOTIFICATION_COMPANY_ID;

export type SdkModules = {
  readonly customers: CustomerModule;
  readonly recommendations: RecommendationModule;
};

export function buildSdkModules(params: { readonly database: Database; readonly logger?: Logger }): SdkModules {
  // Os modulos tipam o banco pelo drizzle 1.x deles; o app esta no 0.4x. A API
  // usada (select/insert/update/onConflict) e' a mesma nas duas linhas.
  const db = params.database as never;
  const customers = createCustomerModule({ db, config: { tenancy: { mode: 'single' }, defaultCountryCode: '55' } });
  const recommendations = createRecommendationModule({
    db,
    config: RECOMMENDATION_CONFIG,
    sponsors: {
      async exists({ sponsorId }) {
        const found = await customers.repositories.customers.findById({ companyId: undefined, id: sponsorId });
        return found !== undefined;
      },
    },
    ...(params.logger ? { logger: params.logger } : {}),
  });
  return { customers, recommendations };
}

/**
 * A sessao do app vem de cookie, e o resolver do app le um `Request`. O
 * `module-http` entrega so cabecalhos: o `Request` sintetico carrega o cookie e
 * nada mais, que e' tudo o que o resolver olha.
 */
export function createAppAuthResolver(resolver: AuthenticatedUserResolver): AuthContextResolverPort {
  return {
    async resolve({ headers }) {
      const user = await resolver.resolve(new Request('http://local/', { headers: { ...headers } }));
      if (!user) return undefined;
      return { companyId: APP_COMPANY_ID, userId: user.userId, scopes: [] };
    },
  };
}

/** Contador publico se infla: a cota e' por pai, como a do resto da API. */
export function withTrackRateLimit(routes: readonly ModuleRoute[], limiter: RateLimiter): ModuleRoute[] {
  return routes.map((route) =>
    route.operationId === TRACK_OPERATION_ID
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

const FEED_OPERATION_ID = 'getRecommendationFeed';

type FeedBody = { readonly data?: { readonly entries?: readonly { readonly sponsored?: boolean }[] } };

/**
 * Assinante com o recurso "sem anuncios" nao ve recomendacao patrocinada. O
 * corte e' aqui, no servidor: escondido so na tela, o patrocinado ainda contaria
 * impressao para o anunciante sem ninguem ter visto.
 */
export function withoutSponsoredFor(
  routes: readonly ModuleRoute[],
  hidesSponsored: (userId: string) => Promise<boolean>,
): ModuleRoute[] {
  return routes.map((route) =>
    route.operationId === FEED_OPERATION_ID
      ? {
          ...route,
          async handler(context) {
            const result = await route.handler(context);
            const userId = context.auth?.userId;
            if (result.kind !== 'json' || !userId || !(await hidesSponsored(userId))) return result;
            const body = result.body as FeedBody;
            if (!body.data?.entries) return result;
            const entries = body.data.entries.filter((entry) => entry.sponsored !== true);
            return { ...result, body: { ...body, data: { ...body.data, entries } } };
          },
        }
      : route,
  );
}

export function buildRecommendationFeedRouter(params: {
  readonly recommendations: RecommendationModule;
  readonly authenticatedUserResolver: AuthenticatedUserResolver;
  /** Sem ele, todo pai ve o patrocinado. */
  readonly hidesSponsored?: ((userId: string) => Promise<boolean>) | undefined;
}): ModuleFetchRouter {
  const created = createRecommendationRoutes({
    module: params.recommendations,
    features: { feed: true, admin: false },
  });
  const routes = params.hidesSponsored ? withoutSponsoredFor(created, params.hidesSponsored) : created;
  return createModuleFetchRouter({
    routes: withTrackRateLimit(routes, createRateLimiter(RECOMMENDATION_EVENTS_RATE_LIMIT)),
    basePath: API_VERSION_PREFIX,
    authResolver: createAppAuthResolver(params.authenticatedUserResolver),
  });
}
