/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { DEFAULT_PLAN_LIMITS, PLAN_LEVELS, type PlanLimitsSettings } from './plan-limits.constant';
import {
  computeBudgetMicroUsd,
  createPlanGate,
  subscriberLevel,
  summarizeBudget,
  trimInsights,
  trimReport,
  type PlanGatePorts,
} from './plan-limits.gate';
import { PlanChatLimitReachedError, PlanFeatureLockedError } from './plan-limits.error';

const ON: PlanLimitsSettings = { ...DEFAULT_PLAN_LIMITS, enabled: true };
const NOW = new Date('2026-11-13T12:00:00Z');
const DOLLAR = 1_000_000;

function gateWith(
  overrides: Partial<Omit<PlanGatePorts, 'settings'>> & { readonly settings?: PlanLimitsSettings } = {},
) {
  const { settings = ON, ...ports } = overrides;
  return createPlanGate({
    settings: async () => settings,
    isSubscriber: async () => false,
    chatCallsSince: async () => ({ count: 0, oldest: undefined }),
    userSpendSince: async () => 0,
    subscriberPoolSince: async () => ({ subscribers: 0, spentMicroUsd: 0 }),
    countChildren: async () => 0,
    now: () => NOW,
    ...ports,
  });
}

describe('chave desligada', () => {
  test('ninguem sente nada: sem limite, com foto e com o Boletim completo', async () => {
    const gate = gateWith({
      settings: DEFAULT_PLAN_LIMITS,
      chatCallsSince: async () => ({ count: 999, oldest: NOW }),
      countChildren: async () => 9,
    });
    await gate.assertCanChat({ userId: 'u', hasImages: true });
    await gate.assertCanUseAudio('u');
    await gate.assertCanAddChild('u');
    expect(await gate.hasFullReports('u')).toBe(true);
    expect((await gate.status('u')).enabled).toBe(false);
  });
});

describe('plano gratuito', () => {
  test('a 11a conversa em 7 dias fica de fora, com a data em que libera', async () => {
    const oldest = new Date('2026-11-10T09:00:00Z');
    const gate = gateWith({ chatCallsSince: async () => ({ count: 10, oldest }) });
    const failure = await gate.assertCanChat({ userId: 'u', hasImages: false }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PlanChatLimitReachedError);
    expect((failure as PlanChatLimitReachedError).statusCode).toBe(402);
    expect((failure as PlanChatLimitReachedError).details).toContainEqual({
      field: 'resetsAt',
      message: '2026-11-17T09:00:00.000Z',
    });
  });

  test('a 10a ainda passa', async () => {
    const gate = gateWith({ chatCallsSince: async () => ({ count: 9, oldest: NOW }) });
    await gate.assertCanChat({ userId: 'u', hasImages: false });
  });

  test('foto e audio sao de quem assina', async () => {
    const gate = gateWith();
    await expect(gate.assertCanChat({ userId: 'u', hasImages: true })).rejects.toBeInstanceOf(PlanFeatureLockedError);
    await expect(gate.assertCanUseAudio('u')).rejects.toBeInstanceOf(PlanFeatureLockedError);
  });

  test('o segundo filho pede assinatura', async () => {
    await gateWith({ countChildren: async () => 0 }).assertCanAddChild('u');
    await expect(gateWith({ countChildren: async () => 1 }).assertCanAddChild('u')).rejects.toBeInstanceOf(
      PlanFeatureLockedError,
    );
  });

  test('insight e Boletim voltam so com o resumo', async () => {
    expect(await gateWith().hasFullReports('u')).toBe(false);
    expect(trimInsights([1, 2, 3], false)).toEqual({ insights: [1], locked: true });
    expect(trimInsights([1, 2, 3], true)).toEqual({ insights: [1, 2, 3], locked: false });
    const report = { grade: 8, motivationalMessage: 'oi', strengths: [1], improvements: [2], nextMonthGoal: 'meta' };
    expect(trimReport(report, false)).toEqual({
      grade: 8,
      motivationalMessage: 'oi',
      strengths: [],
      improvements: [],
      nextMonthGoal: '',
      locked: true,
    });
  });
});

describe('assinante e o teto pela media', () => {
  test('orcamento: 100 assinantes x R$ 19,90 x 30% a R$ 5,50 = US$ 108,55', () => {
    expect(computeBudgetMicroUsd(ON, 100)).toBe(108_545_455);
  });

  const budgetOf = (spent: number, subscribers = 100) =>
    summarizeBudget(ON, { subscribers, spentMicroUsd: spent });

  test('quem usa muito, com o total dentro do orcamento, nao sente nada', () => {
    // Media de US$ 0,50; ele gasta US$ 3, mas o total esta em 46% do orcamento.
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 3 * DOLLAR, budget: budgetOf(50 * DOLLAR) })).toBe(
      PLAN_LEVELS.FULL,
    );
  });

  test('total acima de 80%: so quem esta acima da media entra em economia', () => {
    const budget = budgetOf(90 * DOLLAR);
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 2 * DOLLAR, budget })).toBe(PLAN_LEVELS.ECONOMY);
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 0.5 * DOLLAR, budget })).toBe(PLAN_LEVELS.FULL);
  });

  test('total acima de 100%: quem esta acima da media volta ao limite do gratuito', () => {
    const budget = budgetOf(120 * DOLLAR);
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 2 * DOLLAR, budget })).toBe(PLAN_LEVELS.LIMITED);
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 1 * DOLLAR, budget })).toBe(PLAN_LEVELS.FULL);
  });

  test('o teto individual vale mesmo com o total folgado', () => {
    const budget = budgetOf(10 * DOLLAR);
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 4 * DOLLAR, budget })).toBe(PLAN_LEVELS.ECONOMY);
    expect(subscriberLevel({ settings: ON, userSpentMicroUsd: 5 * DOLLAR, budget })).toBe(PLAN_LEVELS.LIMITED);
  });

  test('em economia, o chat segue e a foto sai; limitado, conta como o gratuito', async () => {
    const economy = gateWith({
      isSubscriber: async () => true,
      userSpendSince: async () => 4 * DOLLAR,
      subscriberPoolSince: async () => ({ subscribers: 100, spentMicroUsd: 10 * DOLLAR }),
      chatCallsSince: async () => ({ count: 500, oldest: NOW }),
    });
    await economy.assertCanChat({ userId: 'u', hasImages: false });
    await expect(economy.assertCanChat({ userId: 'u', hasImages: true })).rejects.toBeInstanceOf(PlanFeatureLockedError);
    expect(await economy.hasFullReports('u')).toBe(true);
    await economy.assertCanAddChild('u');

    const limited = gateWith({
      isSubscriber: async () => true,
      userSpendSince: async () => 6 * DOLLAR,
      subscriberPoolSince: async () => ({ subscribers: 100, spentMicroUsd: 10 * DOLLAR }),
      chatCallsSince: async () => ({ count: 10, oldest: NOW }),
    });
    await expect(limited.assertCanChat({ userId: 'u', hasImages: false })).rejects.toBeInstanceOf(
      PlanChatLimitReachedError,
    );
    expect((await limited.status('u')).level).toBe(PLAN_LEVELS.LIMITED);
  });

  test('o retrato de todos os assinantes e lido uma vez por minuto, nao a cada mensagem', async () => {
    let reads = 0;
    const gate = gateWith({
      isSubscriber: async () => true,
      subscriberPoolSince: async () => {
        reads += 1;
        return { subscribers: 1, spentMicroUsd: 0 };
      },
    });
    await gate.status('u');
    await gate.status('u');
    expect(reads).toBe(1);
  });
});
