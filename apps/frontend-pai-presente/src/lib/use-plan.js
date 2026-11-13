/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O que o plano libera agora. Com a chave do painel desligada, a API responde
 * `enabled: false` e nada aqui trava coisa alguma.
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';

export const PLAN_STATUS_QUERY_KEY = Object.freeze(['plan', 'status']);

/** Os motivos que o convite para assinar sabe explicar. */
export const PLAN_LOCKS = Object.freeze({
  CHAT_LIMIT: 'chat_limit',
  CHAT_MEDIA: 'chat_media',
  CHILDREN: 'children',
  FULL_REPORT: 'full_report',
});

const PLAN_ERROR_CODES = Object.freeze({
  PLAN_CHAT_LIMIT_REACHED: PLAN_LOCKS.CHAT_LIMIT,
});

/** Antes de responder, tudo liberado: travar e destravar um instante depois e' pior. */
export const OPEN_PLAN = Object.freeze({
  enabled: false,
  level: 'full',
  chat: { used: 0, limit: null, resets_at: null },
  media: true,
  full_reports: true,
  max_children: null,
});

export function usePlanStatus() {
  const query = useQuery({
    queryKey: PLAN_STATUS_QUERY_KEY,
    queryFn: () => api.entities.Subscription.usage(),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
  return query.data ?? OPEN_PLAN;
}

/** Conversas que ainda cabem na semana; `null` quando nao ha limite. */
export function chatRemaining(status) {
  const limit = status?.chat?.limit;
  if (limit === null || limit === undefined) return null;
  return Math.max(0, limit - (status.chat.used ?? 0));
}

const detailOf = (error, field) => (error?.details ?? []).find((detail) => detail.field === field)?.message;

/**
 * A recusa do plano (402) vira o motivo e a data em que libera. Qualquer outra
 * falha volta `null` e segue o caminho de erro de sempre.
 */
export function planBlockOf(error) {
  if (error?.status !== 402) return null;
  const lock = PLAN_ERROR_CODES[error.code] ?? detailOf(error, 'lock');
  if (!Object.values(PLAN_LOCKS).includes(lock)) return null;
  return { lock, level: detailOf(error, 'level') ?? null, resetsAt: detailOf(error, 'resetsAt') ?? null };
}
