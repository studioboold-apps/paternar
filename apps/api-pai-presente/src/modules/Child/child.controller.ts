/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { HTTP_METHODS, HTTP_STATUS } from '../shared/http/http.constant';
import { parseJsonBody, parsePagination, parseWithSchema, readClientIp } from '../shared/http/request.util';
import {
  respondWithData,
  respondWithList,
  respondWithNoContent,
} from '../shared/http/response.util';
import type { RouteDefinition } from '../shared/http/route.types';
import { uuidSchema } from '../shared/shared.schema';
import { createChildBodySchema, updateChildBodySchema } from './child.schema';
import type { PlanGate } from '../PlanLimits/plan-limits.gate';
import type { ChildUseCases } from './child.use-case';

const CHILDREN_PATH = '/v1/children';
const CHILD_PATH = '/v1/children/:childId';

export function buildChildRoutes(
  useCases: ChildUseCases,
  options: { readonly planGate?: Pick<PlanGate, 'assertCanAddChild'> | undefined } = {},
): readonly RouteDefinition[] {
  return [
    {
      method: HTTP_METHODS.GET,
      path: CHILDREN_PATH,
      summary: 'Lista os filhos do usuario autenticado.',
      handle: async ({ url, authenticatedUser }) => {
        const { page, perPage, offset } = parsePagination(url);
        const { items, total } = await useCases.list({
          userId: authenticatedUser.userId,
          limit: perPage,
          offset,
        });
        return respondWithList(items, { total, page, perPage });
      },
    },
    {
      method: HTTP_METHODS.POST,
      path: CHILDREN_PATH,
      summary: 'Cadastra um filho.',
      handle: async ({ request, authenticatedUser }) => {
        await options.planGate?.assertCanAddChild(authenticatedUser.userId);
        const values = await parseJsonBody(request, createChildBodySchema);
        const child = await useCases.create({ userId: authenticatedUser.userId, values });
        return respondWithData(child, HTTP_STATUS.CREATED);
      },
    },
    {
      method: HTTP_METHODS.GET,
      path: CHILD_PATH,
      summary: 'Detalha um filho.',
      handle: async ({ pathParams, authenticatedUser }) => {
        const childId = parseWithSchema(uuidSchema, pathParams.childId);
        const child = await useCases.getById({ childId, userId: authenticatedUser.userId });
        return respondWithData(child);
      },
    },
    {
      method: HTTP_METHODS.PATCH,
      path: CHILD_PATH,
      summary: 'Atualiza um filho.',
      handle: async ({ request, pathParams, authenticatedUser }) => {
        const childId = parseWithSchema(uuidSchema, pathParams.childId);
        const values = await parseJsonBody(request, updateChildBodySchema);
        const child = await useCases.update({ childId, userId: authenticatedUser.userId, values });
        return respondWithData(child);
      },
    },
    {
      method: HTTP_METHODS.DELETE,
      path: CHILD_PATH,
      summary: 'Remove um filho.',
      handle: async ({ request, pathParams, authenticatedUser }) => {
        const childId = parseWithSchema(uuidSchema, pathParams.childId);
        await useCases.remove({
          childId,
          userId: authenticatedUser.userId,
          clientIp: readClientIp(request),
        });
        return respondWithNoContent();
      },
    },
  ];
}
