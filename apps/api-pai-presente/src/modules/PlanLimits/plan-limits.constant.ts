/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Limites do plano gratuito e teto de gasto com IA de quem assina. Tudo fica
 * atras de uma chave (`enabled`) que comeca DESLIGADA: com ela desligada, a
 * regra nao roda e ninguem sente nada. Os numeros mudam no painel.
 */

export const PLAN_LIMITS_ROW_ID = 1;

/** Janela do limite de mensagens do gratuito: 7 dias corridos, nao a semana do calendario. */
export const FREE_CHAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Janela do gasto com IA: 30 dias corridos. */
export const SPEND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Mesma tolerancia do `payment-module` para pagamento atrasado. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** O retrato do gasto de todos os assinantes e' caro; um minuto de atraso nao muda nada. */
export const POOL_SNAPSHOT_TTL_MS = 60 * 1000;

export const MICRO_USD_PER_USD = 1_000_000;

export type PlanLimitsSettings = {
  /** A chave: desligada, nada aqui e' aplicado. */
  readonly enabled: boolean;
  readonly freeChatMessagesPerWeek: number;
  readonly freeMaxChildren: number;
  /** Quanto cada assinante rende por mes, liquido, em centavos de real. */
  readonly subscriberRevenueCentsBrl: number;
  /** Quanto dessa receita pode ir para IA, em %. */
  readonly aiShareOfRevenuePct: number;
  /** Cotacao do dolar em centavos de real (550 = R$ 5,50). */
  readonly usdBrlRateCents: number;
  /** Teto individual de seguranca, por assinante em 30 dias, em micro-dolar. */
  readonly individualCapMicroUsd: number;
  /** A partir de quantos % do teto o uso e' reduzido (fotos e audio saem). */
  readonly warnAtPct: number;
};

export const DEFAULT_PLAN_LIMITS: PlanLimitsSettings = Object.freeze({
  enabled: false,
  freeChatMessagesPerWeek: 10,
  freeMaxChildren: 1,
  subscriberRevenueCentsBrl: 1990,
  aiShareOfRevenuePct: 30,
  usdBrlRateCents: 550,
  individualCapMicroUsd: 5 * MICRO_USD_PER_USD,
  warnAtPct: 80,
});

/** O que o pai pode usar agora. */
export const PLAN_LEVELS = {
  /** Chave desligada, ou assinante dentro do orcamento: tudo liberado. */
  FULL: 'full',
  /** Assinante perto do teto: chat segue, fotos e audio saem. */
  ECONOMY: 'economy',
  /** Assinante que passou do teto: volta ao limite do gratuito ate a janela andar. */
  LIMITED: 'limited',
  /** Plano gratuito. */
  FREE: 'free',
} as const;

export type PlanLevel = (typeof PLAN_LEVELS)[keyof typeof PLAN_LEVELS];

/** O que um bloqueio trava; o app escolhe o texto por aqui. */
export const PLAN_LOCKS = {
  CHAT_MEDIA: 'chat_media',
  CHILDREN: 'children',
} as const;

export type PlanLock = (typeof PLAN_LOCKS)[keyof typeof PLAN_LOCKS];

export const PLAN_STATUS_PATH = '/v1/plan/status';

/**
 * Transcricao: o Groq cobra por segundo de audio (whisper-large-v3-turbo,
 * US$ 0,04 por hora, minimo de 10 s). Nao recebemos a duracao, entao ela sai
 * do tamanho do arquivo a uma taxa baixa de proposito: estimar a mais e' o
 * lado seguro.
 */
export const TRANSCRIPTION_ESTIMATE = Object.freeze({
  provider: 'groq',
  defaultModel: 'whisper-large-v3-turbo',
  bitsPerSecond: 24_000,
  minimumSeconds: 10,
});
