/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O painel da equipe. Tudo vem do SDK da casa, e este arquivo so compoe:
 *
 * - `user-module`: quem ENTRA no painel (e-mail e senha da equipe, com papel);
 * - `customer-module`: os ANUNCIANTES, com categoria no catalogo de campos;
 * - `recommendation-module`: a administracao das recomendacoes, campanhas e numeros;
 * - `panel.routes`: o que so o Entrelacos sabe responder (cadastros de pais).
 *
 * A sessao da equipe e' outra, com outro segredo e outro cookie: token de pai
 * nao abre o painel, e o painel nao enxerga a sessao de pai.
 */

import { createCustomerRoutes, type CustomerModule } from '@adatechnology/customer-module';
import type { AuthContext, AuthContextResolverPort, ModuleRouteTable } from '@adatechnology/module-http';
import { createModuleFetchRouter, type ModuleFetchRouter } from '@adatechnology/module-http/fetch';
import type { NotificationModule } from '@adatechnology/notification-module';
import { createRecommendationRoutes, type RecommendationModule } from '@adatechnology/recommendation-module';
import { USER_ERROR_CODE } from '@adatechnology/user-contracts';
import { createUserModule, createUserRoutes, type UserModule } from '@adatechnology/user-module';

import type { Database } from '../../database/client';
import type { Logger } from '../shared/logger/logger';
import {
  ADVERTISER_CATEGORY_FIELD,
  PANEL_BASE_PATH,
  PANEL_COMPANY_ID,
  PANEL_ROLES,
  SCOPES_BY_ROLE,
  type PanelRole,
} from './panel.constant';
import { createPanelAiUsageRepository } from './panel-ai-usage.repository';
import { createPanelEngagementRepository } from './panel-engagement.repository';
import { createPanelHistoryRepository } from './panel-history.repository';
import { buildPanelInsightRoutes } from './panel-insights.routes';
import { createPanelModerationRepository } from './panel-moderation.repository';
import { createSendTemplateTest } from '../Notification/template-test';
import { buildPanelNotificationRoutes } from './panel-notification.routes';
import { createPanelRepository } from './panel.repository';
import { buildPanelRoutes } from './panel.routes';

export type BuildPanelModuleParams = {
  readonly database: Database;
  /** Os mesmos que servem o feed dos pais: uma instancia, dois publicos. */
  readonly customers: CustomerModule;
  readonly recommendations: RecommendationModule;
  readonly notifications?: NotificationModule | undefined;
  readonly jwtSecret: string;
  readonly firstAdmin?: {
    readonly email: string;
    readonly password: string;
    /** Sobrescreve a senha de quem ja existe. Ver `PANEL_ADMIN_RESET`. */
    readonly resetPassword?: boolean;
  };
  /** Troca a senha de um acesso ja existente; injetavel para o teste nao precisar de banco. */
  readonly resetAdminPassword?: (input: { readonly email: string; readonly password: string }) => Promise<number>;
  readonly logger?: Logger;
};

export type PanelModule = {
  readonly router: ModuleFetchRouter;
  readonly users: UserModule;
  /** Cria o primeiro acesso e a categoria de anunciante, se ainda nao existirem. */
  bootstrap(): Promise<void>;
};

const BEARER_PREFIX = 'bearer ';
const EMAIL_ALREADY_EXISTS_CODE = USER_ERROR_CODE.EMAIL_ALREADY_EXISTS;
const MIN_ADMIN_PASSWORD_LENGTH = 8;

function isPanelRole(role: string): role is PanelRole {
  return Object.values(PANEL_ROLES).includes(role as PanelRole);
}

/**
 * Papel desconhecido nao vira escopo nenhum: quem tem token valido com papel
 * inventado entra, mas nao ve nada. Melhor que tratar papel novo como admin.
 */
export function scopesForRole(role: string): readonly string[] {
  return isPanelRole(role) ? SCOPES_BY_ROLE[role] : [];
}

export function createPanelAuthResolver(users: Pick<UserModule, 'verifyAccessToken'>): AuthContextResolverPort {
  return {
    async resolve({ headers }): Promise<AuthContext | undefined> {
      const header = headers['authorization'] ?? '';
      if (!header.toLowerCase().startsWith(BEARER_PREFIX)) return undefined;
      const claims = await users.verifyAccessToken(header.slice(BEARER_PREFIX.length).trim());
      if (!claims) return undefined;
      return { companyId: PANEL_COMPANY_ID, userId: claims.sub, scopes: scopesForRole(claims.role) };
    },
  };
}

type FirstAdmin = NonNullable<BuildPanelModuleParams['firstAdmin']>;
type AdminCredentials = { readonly email: string; readonly password: string };

/**
 * Cria o primeiro admin se o e-mail ainda nao existe. Se ja existe, a senha so
 * e' trocada com `resetPassword` (variavel `PANEL_ADMIN_RESET=1`): e' a porta de
 * recuperacao para quando ninguem mais consegue entrar no painel.
 */
export async function ensureFirstAdmin(params: {
  readonly firstAdmin?: FirstAdmin | undefined;
  readonly createUser: (input: AdminCredentials & { readonly name: string; readonly role: PanelRole }) => Promise<unknown>;
  readonly resetAdminPassword: (input: AdminCredentials) => Promise<number>;
  readonly logger?: Logger | undefined;
}): Promise<void> {
  const { firstAdmin } = params;
  if (!firstAdmin || !firstAdmin.email || !firstAdmin.password) return;

  // Aceita uma lista separada por virgula: todos entram como admin com a mesma senha inicial.
  const emails = unquote(firstAdmin.email)
    .split(',')
    .map(unquote)
    .filter((email) => email.length > 0);
  const password = unquote(firstAdmin.password);
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    params.logger?.error('painel: PANEL_ADMIN_PASSWORD precisa de 8+ caracteres; acesso de admin nao preparado', {
      length: password.length,
    });
    return;
  }

  for (const email of emails) {
    // Acesso do painel nunca derruba a API: erro aqui vira log, e o resto sobe.
    try {
      await ensureOneAdmin({ ...params, email, password, resetPassword: firstAdmin.resetPassword === true });
    } catch (error) {
      params.logger?.error('painel: nao consegui preparar o acesso de admin', {
        email,
        code: (error as { code?: unknown }).code,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Valor colado com aspas no painel do provedor ("x") chega com as aspas: tira. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = trimmed.length >= 2 && /^(["']).*\1$/.test(trimmed);
  return quoted ? trimmed.slice(1, -1).trim() : trimmed;
}

async function ensureOneAdmin(params: {
  readonly email: string;
  readonly password: string;
  readonly resetPassword: boolean;
  readonly createUser: (input: AdminCredentials & { readonly name: string; readonly role: PanelRole }) => Promise<unknown>;
  readonly resetAdminPassword: (input: AdminCredentials) => Promise<number>;
  readonly logger?: Logger | undefined;
}): Promise<void> {
  const credentials = { email: params.email, password: params.password };
  try {
    await params.createUser({ ...credentials, name: 'Administrador', role: PANEL_ROLES.ADMIN });
    params.logger?.info('painel: acesso de admin criado', { email: params.email });
    return;
  } catch (error) {
    // Ja existe: e' o caso de todo boot depois do primeiro.
    if ((error as { code?: unknown }).code !== EMAIL_ALREADY_EXISTS_CODE) throw error;
  }

  if (!params.resetPassword) return;
  const updated = await params.resetAdminPassword(credentials);
  params.logger?.warn('painel: senha do admin redefinida pelo PANEL_ADMIN_RESET; volte a variavel para 0', {
    email: params.email,
    updated,
  });
}

export async function buildPanelModule(params: BuildPanelModuleParams): Promise<PanelModule> {
  // Os modulos tipam o banco pelo drizzle 1.x deles; o app esta no 0.4x. A API
  // usada (select/insert/update/onConflict) e' a mesma nas duas linhas.
  const db = params.database as never;

  const users = await createUserModule({
    db,
    config: {
      tenancy: { mode: 'single', defaultCompanyId: PANEL_COMPANY_ID },
      accessToken: { secret: params.jwtSecret, issuer: 'entrelacos-panel', audience: 'entrelacos-panel' },
    },
  });

  const { customers, recommendations } = params;

  const routes: ModuleRouteTable = [
    ...createUserRoutes({ module: users }),
    ...createCustomerRoutes({ module: customers }),
    ...createRecommendationRoutes({ module: recommendations, features: { feed: false, admin: true } }),
    ...(params.notifications
      ? buildPanelNotificationRoutes({
          notification: params.notifications,
          sendTemplateTest: createSendTemplateTest({
            notification: params.notifications,
            findAppUserIdForStaff: createPanelRepository(params.database).findAppUserIdForStaff,
          }),
        })
      : []),
    ...buildPanelRoutes(createPanelRepository(params.database)),
    ...buildPanelInsightRoutes({
      history: createPanelHistoryRepository(params.database),
      engagement: createPanelEngagementRepository(params.database),
      aiUsage: createPanelAiUsageRepository(params.database),
      moderation: createPanelModerationRepository(params.database),
    }),
  ];

  const router = createModuleFetchRouter({
    routes,
    basePath: PANEL_BASE_PATH,
    authResolver: createPanelAuthResolver(users),
  });

  async function bootstrap(): Promise<void> {
    await ensureFirstAdmin({
      firstAdmin: params.firstAdmin,
      createUser: (input) => users.useCases.createUser.execute(input),
      resetAdminPassword: params.resetAdminPassword ?? createPanelRepository(params.database).resetAdminPassword,
      logger: params.logger,
    });

    const settings = await customers.useCases.getSettings.execute({});
    if (!settings.fieldCatalog.some((field) => field.name === ADVERTISER_CATEGORY_FIELD.name)) {
      await customers.useCases.updateSettings.execute({
        input: {
          maskPhoneInList: settings.maskPhoneInList,
          documentCatalog: settings.documentCatalog,
          fieldCatalog: [...settings.fieldCatalog, ADVERTISER_CATEGORY_FIELD],
        } as never,
      });
    }
  }

  return { router, users, bootstrap };
}
