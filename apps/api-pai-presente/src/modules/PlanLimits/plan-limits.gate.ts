/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A regra de cada plano, sem banco nem HTTP: quem chama entrega as leituras.
 *
 * Gratuito: N conversas em 7 dias, sem foto nem audio, resumo do insight e do
 * Boletim, e ate' M filhos.
 *
 * Assinante: o teto e' pela MEDIA. O orcamento de IA e' "assinantes x receita
 * por assinante x % para IA"; enquanto o gasto de todos couber nele, ninguem
 * sente nada, e quem usa pouco paga quem usa muito. Se o total passa do aviso
 * (80%), so' quem esta' ACIMA da media perde foto e audio; se passa de 100%,
 * essas mesmas pessoas voltam ao limite do gratuito ate' a janela andar. Um
 * teto individual, bem mais alto, segue os mesmos dois degraus contra abuso.
 */

import {
  FREE_CHAT_WINDOW_MS,
  MICRO_USD_PER_USD,
  PLAN_LEVELS,
  PLAN_LOCKS,
  POOL_SNAPSHOT_TTL_MS,
  SPEND_WINDOW_MS,
  type PlanLevel,
  type PlanLimitsSettings,
} from './plan-limits.constant';
import { PlanChatLimitReachedError, PlanFeatureLockedError } from './plan-limits.error';

export type SubscriberPool = {
  /** Assinantes com acesso agora, usem ou nao a IA. */
  readonly subscribers: number;
  /** Gasto de IA desses assinantes na janela, em micro-dolar. */
  readonly spentMicroUsd: number;
};

export type PlanGatePorts = {
  readonly settings: () => Promise<PlanLimitsSettings>;
  readonly isSubscriber: (userId: string) => Promise<boolean>;
  readonly chatCallsSince: (params: {
    readonly userId: string;
    readonly since: Date;
  }) => Promise<{ readonly count: number; readonly oldest: Date | undefined }>;
  readonly userSpendSince: (params: { readonly userId: string; readonly since: Date }) => Promise<number>;
  readonly subscriberPoolSince: (since: Date) => Promise<SubscriberPool>;
  readonly countChildren: (userId: string) => Promise<number>;
  readonly now?: () => Date;
};

export type PlanBudget = {
  readonly budgetMicroUsd: number;
  readonly spentMicroUsd: number;
  readonly subscribers: number;
  readonly averageMicroUsd: number;
};

export type PlanStatus = {
  readonly enabled: boolean;
  readonly level: PlanLevel;
  /** `limit` nulo: sem limite de conversas. */
  readonly chat: { readonly used: number; readonly limit: number | null; readonly resetsAt: string | null };
  readonly media: boolean;
  readonly fullReports: boolean;
  /** Nulo: sem limite de filhos. */
  readonly maxChildren: number | null;
};

export type PlanGate = {
  status(userId: string): Promise<PlanStatus>;
  assertCanChat(params: { readonly userId: string; readonly hasImages: boolean }): Promise<void>;
  assertCanUseAudio(userId: string): Promise<void>;
  assertCanAddChild(userId: string): Promise<void>;
  /** Falso: o insight e o Boletim voltam so' com o resumo. */
  hasFullReports(userId: string): Promise<boolean>;
};

/** Orcamento do mes de IA de todos os assinantes, em micro-dolar. */
export function computeBudgetMicroUsd(settings: PlanLimitsSettings, subscribers: number): number {
  if (settings.usdBrlRateCents <= 0) return 0;
  const revenueUsd = (subscribers * settings.subscriberRevenueCentsBrl) / settings.usdBrlRateCents;
  return Math.round(revenueUsd * (settings.aiShareOfRevenuePct / 100) * MICRO_USD_PER_USD);
}

export function summarizeBudget(settings: PlanLimitsSettings, pool: SubscriberPool): PlanBudget {
  return {
    budgetMicroUsd: computeBudgetMicroUsd(settings, pool.subscribers),
    spentMicroUsd: pool.spentMicroUsd,
    subscribers: pool.subscribers,
    averageMicroUsd: pool.subscribers > 0 ? Math.round(pool.spentMicroUsd / pool.subscribers) : 0,
  };
}

/** O degrau do assinante. Puro: o teste passa os numeros e confere a resposta. */
export function subscriberLevel(params: {
  readonly settings: PlanLimitsSettings;
  readonly userSpentMicroUsd: number;
  readonly budget: PlanBudget;
}): PlanLevel {
  const { settings, userSpentMicroUsd, budget } = params;
  const warn = settings.warnAtPct / 100;
  const individual = settings.individualCapMicroUsd > 0 ? userSpentMicroUsd / settings.individualCapMicroUsd : 0;
  // Sem orcamento configurado (receita zero), a regra da media nao tem com o que comparar.
  const pool = budget.budgetMicroUsd > 0 ? budget.spentMicroUsd / budget.budgetMicroUsd : 0;
  const aboveAverage = userSpentMicroUsd > budget.averageMicroUsd;

  if (individual >= 1 || (aboveAverage && pool >= 1)) return PLAN_LEVELS.LIMITED;
  if (individual >= warn || (aboveAverage && pool >= warn)) return PLAN_LEVELS.ECONOMY;
  return PLAN_LEVELS.FULL;
}

const FULL_STATUS: PlanStatus = Object.freeze({
  enabled: false,
  level: PLAN_LEVELS.FULL,
  chat: { used: 0, limit: null, resetsAt: null },
  media: true,
  fullReports: true,
  maxChildren: null,
});

export function createPlanGate(ports: PlanGatePorts): PlanGate {
  const now = ports.now ?? (() => new Date());
  let poolCache: { readonly at: number; readonly pool: SubscriberPool } | undefined;

  async function subscriberPool(at: Date): Promise<SubscriberPool> {
    if (poolCache && at.getTime() - poolCache.at < POOL_SNAPSHOT_TTL_MS) return poolCache.pool;
    const pool = await ports.subscriberPoolSince(new Date(at.getTime() - SPEND_WINDOW_MS));
    poolCache = { at: at.getTime(), pool };
    return pool;
  }

  async function levelOf(userId: string, settings: PlanLimitsSettings, at: Date): Promise<PlanLevel> {
    if (!(await ports.isSubscriber(userId))) return PLAN_LEVELS.FREE;
    const [userSpentMicroUsd, pool] = await Promise.all([
      ports.userSpendSince({ userId, since: new Date(at.getTime() - SPEND_WINDOW_MS) }),
      subscriberPool(at),
    ]);
    return subscriberLevel({ settings, userSpentMicroUsd, budget: summarizeBudget(settings, pool) });
  }

  async function status(userId: string): Promise<PlanStatus> {
    const settings = await ports.settings();
    if (!settings.enabled) return FULL_STATUS;

    const at = now();
    const level = await levelOf(userId, settings, at);
    const isFree = level === PLAN_LEVELS.FREE;
    const countsChat = isFree || level === PLAN_LEVELS.LIMITED;

    let chat: PlanStatus['chat'] = { used: 0, limit: null, resetsAt: null };
    if (countsChat) {
      const { count, oldest } = await ports.chatCallsSince({
        userId,
        since: new Date(at.getTime() - FREE_CHAT_WINDOW_MS),
      });
      const resetsAt = oldest ? new Date(oldest.getTime() + FREE_CHAT_WINDOW_MS).toISOString() : null;
      chat = { used: count, limit: settings.freeChatMessagesPerWeek, resetsAt };
    }

    return {
      enabled: true,
      level,
      chat,
      media: level === PLAN_LEVELS.FULL,
      fullReports: !isFree,
      maxChildren: isFree ? settings.freeMaxChildren : null,
    };
  }

  return {
    status,

    async assertCanChat({ userId, hasImages }) {
      const current = await status(userId);
      if (hasImages && !current.media) {
        throw new PlanFeatureLockedError({ lock: PLAN_LOCKS.CHAT_MEDIA, level: current.level });
      }
      const { used, limit, resetsAt } = current.chat;
      if (limit !== null && used >= limit) {
        throw new PlanChatLimitReachedError({ limit, resetsAt: resetsAt ? new Date(resetsAt) : now() });
      }
    },

    async assertCanUseAudio(userId) {
      const current = await status(userId);
      if (!current.media) throw new PlanFeatureLockedError({ lock: PLAN_LOCKS.CHAT_MEDIA, level: current.level });
    },

    async assertCanAddChild(userId) {
      const current = await status(userId);
      if (current.maxChildren === null) return;
      if ((await ports.countChildren(userId)) >= current.maxChildren) {
        throw new PlanFeatureLockedError({ lock: PLAN_LOCKS.CHILDREN, level: current.level });
      }
    },

    async hasFullReports(userId) {
      return (await status(userId)).fullReports;
    },
  };
}

/** O insight do gratuito: o primeiro, e o aviso de que ha' mais. */
export function trimInsights<T>(insights: readonly T[], full: boolean): { insights: readonly T[]; locked: boolean } {
  if (full || insights.length <= 1) return { insights, locked: false };
  return { insights: insights.slice(0, 1), locked: true };
}

/** O Boletim do gratuito: a nota e a mensagem; pontos fortes, melhorias e meta ficam para quem assina. */
export function trimReport<
  T extends { strengths: readonly unknown[]; improvements: readonly unknown[]; nextMonthGoal: string },
>(report: T, full: boolean): T & { locked: boolean } {
  if (full) return { ...report, locked: false };
  return { ...report, strengths: [], improvements: [], nextMonthGoal: '', locked: true };
}
