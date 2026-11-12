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
import {
  createNotificationModule,
  createNotificationRoutes,
  type NotificationModule,
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
};

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
      ...(params.logger ? { logger: params.logger } : {}),
    },
  });
}

export function buildNotificationRouter(params: {
  readonly notification: NotificationModule;
  readonly authenticatedUserResolver: AuthenticatedUserResolver;
  readonly vapidPublicKey?: string | undefined;
}): ModuleFetchRouter {
  const routes = createNotificationRoutes({
    module: params.notification,
    ...(params.vapidPublicKey ? { vapidPublicKey: params.vapidPublicKey } : {}),
  });

  return createModuleFetchRouter({
    authResolver: createAppAuthResolver(params.authenticatedUserResolver),
    basePath: API_VERSION_PREFIX,
    routes,
  });
}
