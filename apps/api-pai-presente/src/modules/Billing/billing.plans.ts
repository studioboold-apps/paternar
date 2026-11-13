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

import { HOTMART_PROVIDER_NAME, readHotmartOfferCode } from '@adatechnology/hotmart-payment-provider';
import type { PlanDefinition, PlanOffer } from '@adatechnology/payment-contracts';
import { FAKE_PAYMENT_PROVIDER_NAME } from '@adatechnology/payment-module/testing';

import { FAKE_CHECKOUT_BASE_URL } from './billing.constant';

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

export type BillingOfferInput = {
  /** Link de checkout da oferta na Hotmart (`https://pay.hotmart.com/XXX?off=yyy`). Vazio: sem oferta. */
  readonly hotmartCheckoutUrl: string;
  /** Oferta do provedor falso, so fora de producao. */
  readonly fakeOfferCode?: string | undefined;
};

export type BillingOffers = { readonly monthly: BillingOfferInput; readonly yearly: BillingOfferInput };

const PREMIUM_FEATURES = BILLING_FEATURE_VALUES;

function offersOf(input: BillingOfferInput): PlanOffer[] {
  const offers: PlanOffer[] = [];
  const url = input.hotmartCheckoutUrl.trim();
  const offerCode = url ? readHotmartOfferCode(url) : null;
  if (url && offerCode) offers.push({ provider: HOTMART_PROVIDER_NAME, offerCode, checkoutUrl: url });
  if (input.fakeOfferCode) {
    offers.push({
      provider: FAKE_PAYMENT_PROVIDER_NAME,
      offerCode: input.fakeOfferCode,
      checkoutUrl: `${FAKE_CHECKOUT_BASE_URL}?off=${input.fakeOfferCode}`,
    });
  }
  return offers;
}

/** O catalogo que o `payment-module` recebe. A oferta e' lida do proprio link da Hotmart (`off`). */
export function buildPlanCatalog(offers: BillingOffers): PlanDefinition[] {
  return [
    {
      code: BILLING_PLAN_CODES.FREE,
      name: 'Gratuito',
      description: 'O essencial do Entrelaços.',
      interval: 'none',
      features: [],
      offers: [],
      isFree: true,
    },
    {
      code: BILLING_PLAN_CODES.PREMIUM_MONTHLY,
      name: 'Premium mensal',
      description: 'Tudo liberado, cobrado todo mês.',
      interval: 'month',
      features: PREMIUM_FEATURES,
      offers: offersOf(offers.monthly),
    },
    {
      code: BILLING_PLAN_CODES.PREMIUM_YEARLY,
      name: 'Premium anual',
      description: 'Tudo liberado, cobrado uma vez por ano.',
      interval: 'year',
      features: PREMIUM_FEATURES,
      offers: offersOf(offers.yearly),
    },
  ];
}

/** Quem pagou uma oferta que ainda nao esta no catalogo nao fica sem acesso. */
export const FALLBACK_PAID_PLAN_CODE = BILLING_PLAN_CODES.PREMIUM_MONTHLY;
