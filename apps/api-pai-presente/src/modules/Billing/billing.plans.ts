/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O catalogo de planos. PROVISORIO: nomes, recursos e precos ainda nao foram
 * decididos. O preco quem mostra e cobra e' a Hotmart (no checkout); aqui so
 * mora o que cada plano libera e qual link de checkout leva a ele.
 *
 * Trocar o catalogo e' editar este arquivo. O link de cada plano pago vem do
 * ambiente (`HOTMART_CHECKOUT_URL_*`) porque muda entre teste e producao.
 */

/** O que um plano pode liberar. Nenhuma rota exige recurso ainda: ligar e' decisao de produto. */
export const BILLING_FEATURES = {
  /** Chat com a IA sem o limite do plano gratuito. */
  AI_UNLIMITED: 'ia_ilimitada',
  /** Boletim completo do filho. */
  FULL_REPORT: 'boletim_completo',
  /** Sem recomendacoes patrocinadas no feed. */
  NO_ADS: 'sem_anuncios',
} as const;

export type BillingFeature = (typeof BILLING_FEATURES)[keyof typeof BILLING_FEATURES];
export const BILLING_FEATURE_VALUES = Object.values(BILLING_FEATURES);

export const BILLING_PLAN_CODES = {
  FREE: 'gratuito',
  PREMIUM_MONTHLY: 'premium_mensal',
  PREMIUM_YEARLY: 'premium_anual',
} as const;

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[keyof typeof BILLING_PLAN_CODES];

export type BillingPlan = {
  readonly code: BillingPlanCode;
  readonly name: string;
  readonly description: string;
  readonly interval: 'none' | 'month' | 'year';
  readonly features: readonly BillingFeature[];
  /** Link de checkout da oferta no provedor; `null` no gratuito ou quando nao configurado. */
  readonly checkoutUrl: string | null;
};

export type BillingCheckoutUrls = {
  readonly monthly: string;
  readonly yearly: string;
};

const PREMIUM_FEATURES = BILLING_FEATURE_VALUES;

export function buildPlanCatalog(checkout: BillingCheckoutUrls): readonly BillingPlan[] {
  const orNull = (value: string) => (value.trim().length > 0 ? value.trim() : null);
  return [
    {
      code: BILLING_PLAN_CODES.FREE,
      name: 'Gratuito',
      description: 'O essencial do Entrelaços.',
      interval: 'none',
      features: [],
      checkoutUrl: null,
    },
    {
      code: BILLING_PLAN_CODES.PREMIUM_MONTHLY,
      name: 'Premium mensal',
      description: 'Tudo liberado, cobrado todo mês.',
      interval: 'month',
      features: PREMIUM_FEATURES,
      checkoutUrl: orNull(checkout.monthly),
    },
    {
      code: BILLING_PLAN_CODES.PREMIUM_YEARLY,
      name: 'Premium anual',
      description: 'Tudo liberado, cobrado uma vez por ano.',
      interval: 'year',
      features: PREMIUM_FEATURES,
      checkoutUrl: orNull(checkout.yearly),
    },
  ];
}

/** Plano pago usado quando a oferta do evento nao bate com nenhum link (oferta nova no provedor). */
export const FALLBACK_PAID_PLAN_CODE = BILLING_PLAN_CODES.PREMIUM_MONTHLY;
