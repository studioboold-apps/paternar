/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * As rotas do painel que respondem "o que esta acontecendo no app": ficha do
 * pai, uso, custo de IA, denuncias e a trilha do que a propria equipe fez.
 */

import { ROUTE_SCOPE, type ModuleRoute, type RequestContext } from '@adatechnology/module-http';
import { z } from 'zod';

import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../Audit/audit.constant';
import { REPORT_STATUSES } from '../CommunityReport/community-report.constant';
import type { PanelAiUsageRepository } from './panel-ai-usage.repository';
import type { PanelEngagementRepository } from './panel-engagement.repository';
import type { PanelHistoryRepository } from './panel-history.repository';
import type { PanelModerationRepository } from './panel-moderation.repository';
import { PANEL_SCOPES } from './panel.constant';

export type PanelInsightDependencies = {
  readonly history: Pick<PanelHistoryRepository, 'userDetail' | 'listTeamAccess' | 'recordPanelAction'>;
  readonly engagement: Pick<PanelEngagementRepository, 'engagement'>;
  readonly aiUsage: Pick<PanelAiUsageRepository, 'summary'>;
  readonly moderation: Pick<PanelModerationRepository, 'listReports' | 'resolveReport'>;
};

/** Mesma forma de erro que o filtro do `module-http` reconhece (statusCode/code/message). */
class PanelRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const uuid = z.uuid();
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
const aiUsageQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
const reportsQuerySchema = pageSchema.extend({ status: z.enum(REPORT_STATUSES).default('open') });
const resolveBodySchema = z.object({ action: z.enum(['dismiss', 'remove']) }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PanelRequestError(400, 'VALIDATION_ERROR', 'Parametros invalidos.');
  return parsed.data;
}

/**
 * Sem `bodySchema` (o do `module-http` e' zod 3; o app e' zod 4), o corpo chega
 * so' em bytes: le aqui e valida com o schema do app.
 */
function readBody(context: RequestContext): unknown {
  if (context.body !== undefined && context.body !== null) return context.body;
  if (!context.rawBody || context.rawBody.length === 0) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(context.rawBody));
  } catch {
    throw new PanelRequestError(400, 'VALIDATION_ERROR', 'Corpo da requisicao nao e JSON.');
  }
}

function json(body: unknown, status = 200) {
  return { kind: 'json' as const, status, body };
}

/** Quem da equipe esta pedindo, e de onde: e' o que a trilha guarda. */
function actorOf(context: RequestContext): { readonly actorId: string; readonly clientIp: string } {
  const actorId = context.auth?.userId;
  if (!actorId) throw new PanelRequestError(401, 'UNAUTHENTICATED', 'Sessao da equipe necessaria.');
  const forwarded = context.headers['x-forwarded-for']?.split(',')[0]?.trim();
  return { actorId, clientIp: (context.ip ?? forwarded ?? 'desconhecido').slice(0, 64) };
}

export function buildPanelInsightRoutes(deps: PanelInsightDependencies): ModuleRoute[] {
  return [
    {
      method: 'GET',
      path: '/me',
      scope: ROUTE_SCOPE.USER,
      operationId: 'getPanelMe',
      summary: 'Quem esta no painel e o que pode fazer',
      async handler(context) {
        return json({ data: { userId: context.auth?.userId ?? null, scopes: context.auth?.scopes ?? [] } });
      },
    },
    {
      method: 'GET',
      path: '/engagement',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelEngagement',
      summary: 'Pais ativos, retencao, funil e uso dos recursos',
      async handler() {
        return json({ data: await deps.engagement.engagement() });
      },
    },
    {
      method: 'GET',
      path: '/app-users/:id',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelAppUser',
      summary: 'Ficha do pai: numeros e linha do tempo (sem conteudo privado)',
      async handler(context) {
        const userId = parse(uuid, context.params.id);
        const { actorId, clientIp } = actorOf(context);
        const detail = await deps.history.userDetail(userId);
        if (detail === undefined) throw new PanelRequestError(404, 'APP_USER_NOT_FOUND', 'Pai nao encontrado.');
        await deps.history.recordPanelAction({
          actorId,
          clientIp,
          action: AUDIT_ACTIONS.PANEL_USER_VIEWED,
          targetType: AUDIT_TARGET_TYPES.ACCOUNT,
          targetId: userId,
        });
        return json({ data: detail });
      },
    },
    {
      method: 'GET',
      path: '/ai-usage',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelAiUsage',
      summary: 'Chamadas, tokens e custo da IA no periodo',
      async handler(context) {
        const { days } = parse(aiUsageQuerySchema, context.query);
        return json({ data: await deps.aiUsage.summary({ days }) });
      },
    },
    {
      method: 'GET',
      path: '/reports',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'listPanelReports',
      summary: 'Denuncias da comunidade por situacao',
      async handler(context) {
        const query = parse(reportsQuerySchema, context.query);
        const { rows, total } = await deps.moderation.listReports(query);
        return json({ data: rows, pagination: { total, page: query.page, perPage: query.perPage } });
      },
    },
    {
      method: 'POST',
      path: '/reports/:id/resolve',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.COMMUNITY_MODERATE],
      operationId: 'resolvePanelReport',
      summary: 'Arquiva a denuncia ou tira o conteudo do ar (vale para todas as denuncias do mesmo conteudo)',
      async handler(context) {
        const reportId = parse(uuid, context.params.id);
        const { action } = parse(resolveBodySchema, readBody(context));
        const { actorId, clientIp } = actorOf(context);
        const result = await deps.moderation.resolveReport({ reportId, action, resolvedBy: actorId });
        if (result === undefined) throw new PanelRequestError(404, 'REPORT_NOT_FOUND', 'Denuncia nao encontrada.');
        await deps.history.recordPanelAction({
          actorId,
          clientIp,
          action: action === 'remove' ? AUDIT_ACTIONS.PANEL_CONTENT_REMOVED : AUDIT_ACTIONS.PANEL_REPORT_DISMISSED,
          targetType: AUDIT_TARGET_TYPES.COMMUNITY_REPORT,
          targetId: reportId,
        });
        return json({ data: result });
      },
    },
    {
      method: 'GET',
      path: '/team-access',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.USERS_ADMIN],
      operationId: 'listPanelTeamAccess',
      summary: 'Trilha do painel: quem da equipe viu ou mexeu em quem',
      async handler(context) {
        const query = parse(pageSchema, context.query);
        const { rows, total } = await deps.history.listTeamAccess(query);
        return json({ data: rows, pagination: { total, ...query } });
      },
    },
  ];
}
