/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { sql } from 'drizzle-orm';

import { readEnvironment } from './config/environment';
import { createDatabaseClient } from './database/client';
import { buildApplicationRoutes } from './app';
import { buildAuthModule } from './modules/Auth/auth.module';
import { buildBillingModule } from './modules/Billing/billing.module';
import { BILLING_FEATURES } from './modules/Billing/billing.plans';
import { createCorsPolicy } from './modules/shared/http/cors';
import {
  HEALTH_PATH,
  HTTP_METHODS,
  SERVER_BIND_HOSTNAME,
  SHUTDOWN_TIMEOUT_MS,
} from './modules/shared/http/http.constant';
import { createRouter } from './modules/shared/http/router';
import { checkHealth, respondWithHealth } from './modules/shared/health/health.use-case';
import { createLogger } from './modules/shared/logger/logger';
import { buildPanelModule } from './modules/Panel/panel.module';
import { buildRecommendationFeedRouter, buildSdkModules } from './modules/Recommendation/recommendation.module';
import {
  buildNotificationModule,
  buildNotificationRouter,
  createNotificationQueue,
  startNotificationWorker,
} from './modules/Notification/notification.module';
import { bootstrapNotificationTemplates } from './modules/Notification/seed-templates';

const environment = readEnvironment();
const logger = createLogger({ traceId: 'boot', source: 'main' });
const database = createDatabaseClient(environment.DATABASE_URL);

const isProduction = environment.NODE_ENV === 'production';
const auth = buildAuthModule({
  database,
  jwtSecret: environment.AUTH_JWT_SECRET,
  clientIds: { google: environment.GOOGLE_CLIENT_ID, apple: environment.APPLE_CLIENT_ID },
  developmentSignIn: { isEnabled: environment.AUTH_DEV_SIGN_IN, isProduction },
  isPasswordSignInEnabled: environment.AUTH_PASSWORD_SIGN_IN,
  // `Secure` sai de NODE_ENV, nao de uma variavel propria: variavel esquecida
  // no painel nao pode ser o que manda o cookie de sessao viajar em claro.
  isSecureCookie: isProduction,
});

const notificationQueue = createNotificationQueue();
const notificationModule = buildNotificationModule({
  database,
  queue: notificationQueue,
  logger: logger.withScope('notification'),
  suppressionHmacKey: environment.NOTIFICATION_SUPPRESSION_HMAC_KEY,
  vapidKeys:
    environment.VAPID_PUBLIC_KEY && environment.VAPID_PRIVATE_KEY
      ? {
          publicKey: environment.VAPID_PUBLIC_KEY,
          privateKey: environment.VAPID_PRIVATE_KEY,
          subject: environment.VAPID_SUBJECT,
        }
      : undefined,
});
await bootstrapNotificationTemplates(database);
// Sem consumidor, a fila em memoria so acumula: nenhum push chegava ao aparelho.
await startNotificationWorker({
  notification: notificationModule,
  queue: notificationQueue,
  logger: logger.withScope('notification-worker'),
});
if (!environment.VAPID_PUBLIC_KEY || !environment.VAPID_PRIVATE_KEY) {
  logger.warn('push desligado: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY vazias; so a caixa de entrada funciona');
}

const DISPATCH_INTERVAL_MS = 60_000;
const dispatchTimer = setInterval(async () => {
  try {
    await notificationModule.useCases.dispatchDueNotifications.execute();
  } catch (error) {
    logger.withScope('notification-dispatch').warn('falha ao despachar notificacoes agendadas', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}, DISPATCH_INTERVAL_MS);
dispatchTimer.unref?.();

if (!environment.HOTMART_HOTTOK) {
  logger.warn('pagamentos: HOTMART_HOTTOK vazio; o webhook da Hotmart responde 503');
}

const router = createRouter({
  routes: [
    ...buildApplicationRoutes({
      database,
      notifications: notificationModule,
      llm: {
        providerName: environment.LLM_PROVIDER,
        apiKey: environment.LLM_API_KEY,
        model: environment.LLM_MODEL,
        modelFast: environment.LLM_MODEL_FAST,
        transcription: {
          apiKey: environment.TRANSCRIPTION_GROQ_API_KEY,
          model: environment.TRANSCRIPTION_MODEL,
        },
      },
      media: {
        destination: environment.MEDIA_DESTINATION,
        directory: environment.MEDIA_DIRECTORY,
        bucket: environment.MEDIA_S3_BUCKET,
        endpoint: environment.MEDIA_S3_ENDPOINT,
        encryptionKey: environment.MEDIA_ENCRYPTION_KEY,
      },
    }),
  ],
  publicRoutes: auth.publicRoutes,
  authenticatedUserResolver: auth.authenticatedUserResolver,
});
const cors = createCorsPolicy(environment.WEB_ORIGINS);

const billing = buildBillingModule({
  database,
  config: {
    hotmart: {
      hottok: environment.HOTMART_HOTTOK,
      checkoutUrls: {
        monthly: environment.HOTMART_CHECKOUT_URL_MONTHLY,
        yearly: environment.HOTMART_CHECKOUT_URL_YEARLY,
      },
    },
    fakeSecret: environment.PAYMENTS_FAKE_SECRET,
    isProduction,
  },
  authenticatedUserResolver: auth.authenticatedUserResolver,
  logger: logger.withScope('billing'),
});

const sdk = buildSdkModules({ database, logger: logger.withScope('recommendation') });
const recommendationFeed = buildRecommendationFeedRouter({
  recommendations: sdk.recommendations,
  authenticatedUserResolver: auth.authenticatedUserResolver,
  hidesSponsored: (userId) =>
    billing.payments.useCases.hasFeature({ customerRef: userId }, BILLING_FEATURES.NO_ADS),
});

const notificationRouter = buildNotificationRouter({
  notification: notificationModule,
  authenticatedUserResolver: auth.authenticatedUserResolver,
  vapidPublicKey: environment.VAPID_PUBLIC_KEY || undefined,
});

/**
 * Sem `PANEL_JWT_SECRET` o painel nao existe: `/v1/panel/*` cai no 404 do
 * roteador do app, como qualquer rota desconhecida.
 */
const panel =
  environment.PANEL_JWT_SECRET === ''
    ? undefined
    : await buildPanelModule({
        database,
        customers: sdk.customers,
        recommendations: sdk.recommendations,
        notifications: notificationModule,
        payments: billing.payments,
        jwtSecret: environment.PANEL_JWT_SECRET,
        firstAdmin: {
          email: environment.PANEL_ADMIN_EMAIL,
          password: environment.PANEL_ADMIN_PASSWORD,
          resetPassword: environment.PANEL_ADMIN_RESET,
        },
        logger: logger.withScope('panel'),
      });
await panel?.bootstrap();

/**
 * `select 1` a cada consulta de saude: e' o que separa "o processo subiu" de "a
 * API funciona". Barato o bastante para o intervalo do provedor, e e' o unico
 * jeito de o deploy quebrado nao ser promovido.
 */
const pingDatabase = (): Promise<unknown> => database.execute(sql`select 1`);

// /health fica FORA da tabela de rotas de proposito: assim toda rota da tabela e
// autenticada por construcao, e nao por lembrar de marcar cada uma.
const server = Bun.serve({
  hostname: SERVER_BIND_HOSTNAME,
  port: environment.API_PORT,
  async fetch(request: Request): Promise<Response> {
    const intercepted = cors.intercept(request);
    if (intercepted !== undefined) return intercepted;

    const url = new URL(request.url);
    if (url.pathname === HEALTH_PATH && request.method === HTTP_METHODS.GET) {
      return cors.decorate(request, respondWithHealth(await checkHealth({ pingDatabase })));
    }
    if (panel?.router.match(request)) return cors.decorate(request, await panel.router.handle(request));
    if (recommendationFeed.match(request)) return cors.decorate(request, await recommendationFeed.handle(request));
    if (billing.router.match(request)) return cors.decorate(request, await billing.router.handle(request));
    if (notificationRouter.match(request)) return cors.decorate(request, await notificationRouter.handle(request));
    return cors.decorate(request, await router.handle(request));
  },
});

logger.info('api no ar', { port: server.port, nodeEnv: environment.NODE_ENV });

function shutdown(signal: string): void {
  logger.info('encerrando', { signal });
  const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();
  void server.stop(true).then(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
