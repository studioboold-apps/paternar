/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { chatRemaining, OPEN_PLAN, planBlockOf, PLAN_LOCKS } from '@/lib/use-plan';

describe('limites do plano no app', () => {
  test('sem limite, sem contador', () => {
    expect(chatRemaining(OPEN_PLAN)).toBeNull();
    expect(chatRemaining({ chat: { used: 7, limit: 10 } })).toBe(3);
    expect(chatRemaining({ chat: { used: 12, limit: 10 } })).toBe(0);
  });

  test('a recusa 402 vira o motivo e a data', () => {
    const limit = { status: 402, code: 'PLAN_CHAT_LIMIT_REACHED', details: [{ field: 'resetsAt', message: '2026-11-20T00:00:00.000Z' }] };
    expect(planBlockOf(limit)).toEqual({ lock: PLAN_LOCKS.CHAT_LIMIT, level: null, resetsAt: '2026-11-20T00:00:00.000Z' });
    const media = { status: 402, code: 'PLAN_FEATURE_LOCKED', details: [{ field: 'lock', message: 'chat_media' }, { field: 'level', message: 'economy' }] };
    expect(planBlockOf(media)).toEqual({ lock: PLAN_LOCKS.CHAT_MEDIA, level: 'economy', resetsAt: null });
  });

  test('outra falha segue o caminho de sempre', () => {
    expect(planBlockOf({ status: 503, code: 'AI_NOT_CONFIGURED' })).toBeNull();
    expect(planBlockOf(undefined)).toBeNull();
  });
});
