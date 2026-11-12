/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Notificacoes (inbox + web push) pelo SDK da casa (@adatechnology/notification-module).
 * Destinado ao app dos pais (Paternar) para comunicacao de rotina, atividades e avisos.
 */

import { eq } from 'drizzle-orm';
import type { ModuleFetchRouter } from '@adatechnology/module-http/fetch';
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch';
import type { QueuePort } from '@adatechnology/notification-contracts';
import {
  createInProcessQueue,
  createNotificationModule,
  createNotificationRoutes,
  createNotificationWorker,
  type NotificationModule,
  type NotificationWorker,
} from '@adatechnology/notification-module';
import { createWebPushProvider } from '@adatechnology/push-provider';

import type { Database } from '../../database/client';
import { usersTable } from '../User/user.table';
import type { AuthenticatedUserResolver } from '../shared/auth/authenticated-user.interface';
import { API_VERSION_PREFIX } from '../shared/http/http.constant';
import type { Logger } from '../shared/logger/logger';
import { createAppAuthResolver } from '../Recommendation/recommendation.module';

export type BuildNotificationModuleParams = {
  readonly database: Database;
  readonly logger?: Logger | undefined;
  readonly suppressionHmacKey: string;
  readonly vapidKeys?: {
    readonly publicKey: string;
    readonly privateKey: string;
    readonly subject: string;
  } | undefined;
  /**
   * A fila que liga o envio ao despacho. Sem ela o modulo cria uma propria e
   * ninguem a consome: a notificacao fica `queued` para sempre e o push nunca
   * sai. Quem monta o modulo passa a mesma fila para `startNotificationWorker`.
   */
  readonly queue?: QueuePort | undefined;
};

/** Fila em memoria: o worker roda no mesmo processo da API (uma replica). */
export function createNotificationQueue(): QueuePort {
  return createInProcessQueue();
}

/**
 * Liga o consumidor da fila. Sem isto, o envio grava a notificacao e a
 * entrega, e para ai: nenhum push chega ao aparelho.
 */
export async function startNotificationWorker(params: {
  readonly notification: NotificationModule;
  readonly queue: QueuePort;
  readonly logger?: Logger | undefined;
}): Promise<NotificationWorker> {
  const worker = createNotificationWorker({
    module: params.notification,
    queue: params.queue,
    ...(params.logger ? { logger: params.logger } : {}),
  });
  await worker.start();
  return worker;
}

export function buildNotificationModule(params: BuildNotificationModuleParams): NotificationModule {
  const db = params.database as never;
  const hasVapid = Boolean(params.vapidKeys?.publicKey && params.vapidKeys?.privateKey);
  const pushDriver = hasVapid && params.vapidKeys ? createWebPushProvider({ vapidKeys: params.vapidKeys }) : undefined;

  return createNotificationModule({
    db,
    config: {
      defaultLocale: 'pt-BR',
      defaultTimezone: 'America/Sao_Paulo',
      suppressionHmacKey: params.suppressionHmacKey,
    },
    features: {
      push: pushDriver !== undefined,
    },
    providers: {
      recipientResolver: {
        async resolve({ userId }) {
          const [row] = await params.database
            .select({
              id: usersTable.id,
              email: usersTable.email,
              fullName: usersTable.fullName,
            })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);

          if (!row) return undefined;

          return {
            userId: row.id,
            email: row.email,
            name: row.fullName ?? undefined,
            locale: 'pt-BR',
            timezone: 'America/Sao_Paulo',
          };
        },
      },
      channels: {
        ...(pushDriver === undefined ? {} : { push: pushDriver }),
      },
      ...(params.queue ? { queue: params.queue } : {}),
      ...(params.logger ? { logger: params.logger } : {}),
    },
  });
}

/**
 * O que o app dos pais pode chamar: a propria caixa de entrada, os proprios
 * aparelhos, as proprias preferencias e a chave VAPID. As rotas `admin`
 * (modelos e politicas) e `service` (disparar para qualquer pai) do SDK nao
 * pedem escopo nenhum, e no roteador do app bastaria estar logado para editar
 * o texto que chega a todo mundo ou mandar push para outro pai.
 */
const APP_NOTIFICATION_SCOPES: ReadonlySet<string> = new Set(['user', 'public']);

export function buildNotificationRouter(params: {
  readonly notification: NotificationModule;
  readonly authenticatedUserResolver: AuthenticatedUserResolver;
  readonly vapidPublicKey?: string | undefined;
}): ModuleFetchRouter {
  const routes = createNotificationRoutes({
    module: params.notification,
    ...(params.vapidPublicKey ? { vapidPublicKey: params.vapidPublicKey } : {}),
  }).filter((route) => APP_NOTIFICATION_SCOPES.has(route.scope));

  return createModuleFetchRouter({
    authResolver: createAppAuthResolver(params.authenticatedUserResolver),
    basePath: API_VERSION_PREFIX,
    routes,
  });
}
