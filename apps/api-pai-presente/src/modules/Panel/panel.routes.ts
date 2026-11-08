/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { ROUTE_SCOPE, type ModuleRoute } from '@adatechnology/module-http';
import { z } from 'zod';

import { PANEL_SCOPES } from './panel.constant';
import type { PanelRepository } from './panel.repository';

/**
 * A validacao fica no handler, e nao em `querySchema`: o `module-http` tipa o
 * schema pelo zod 3 dele, e o app esta no zod 4. O erro sai na forma que o
 * filtro do `module-http` reconhece (statusCode/code/message).
 */
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
});

const userIdSchema = z.string().uuid();
const blockBodySchema = z.object({ blocked: z.boolean() });

class PanelQueryError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

class PanelUserNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

/** So o que as rotas usam: o teste troca o banco por um falso. */
/**
 * Sem `bodySchema` (pelo mesmo motivo do zod 3), o `module-http` nao le o
 * corpo: le-se aqui dos bytes crus. JSON quebrado vira `undefined` e cai no 400.
 */
function readJsonBody(rawBody: Uint8Array | undefined): unknown {
  if (!rawBody || rawBody.length === 0) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return undefined;
  }
}

type PanelRoutesRepository = Pick<PanelRepository, 'overview' | 'listUsers' | 'setUserBlocked'>;

export function buildPanelRoutes(repository: PanelRoutesRepository): ModuleRoute[] {
  return [
    {
      method: 'GET',
      path: '/overview',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'getPanelOverview',
      summary: 'Totais de cadastro e uso do app',
      async handler() {
        return { kind: 'json', status: 200, body: { data: await repository.overview() } };
      },
    },
    {
      method: 'GET',
      path: '/app-users',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.READ],
      operationId: 'listPanelAppUsers',
      summary: 'Pais cadastrados no app, com busca por nome ou e-mail',
      async handler(context) {
        const parsed = listUsersQuerySchema.safeParse(context.query);
        if (!parsed.success) throw new PanelQueryError('Parametros de busca invalidos.');
        const { rows, total } = await repository.listUsers({
          page: parsed.data.page,
          perPage: parsed.data.perPage,
          ...(parsed.data.search ? { search: parsed.data.search } : {}),
        });
        return {
          kind: 'json',
          status: 200,
          body: { data: rows, pagination: { total, page: parsed.data.page, perPage: parsed.data.perPage } },
        };
      },
    },
    {
      method: 'PUT',
      path: '/app-users/:id/blocked',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [PANEL_SCOPES.APP_USERS_BLOCK],
      operationId: 'setPanelAppUserBlocked',
      summary: 'Bloqueia ou libera um pai: bloqueado nao entra nem usa o app',
      async handler(context) {
        const userId = userIdSchema.safeParse(context.params['id']);
        const body = blockBodySchema.safeParse(readJsonBody(context.rawBody));
        if (!userId.success || !body.success) throw new PanelQueryError('Informe o pai e se ele fica bloqueado.');
        const updated = await repository.setUserBlocked({ userId: userId.data, blocked: body.data.blocked });
        if (!updated) throw new PanelUserNotFoundError('Pai nao encontrado.');
        return { kind: 'json', status: 200, body: { data: updated } };
      },
    },
  ];
}
