/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';
import { planCatalogSchema } from '@adatechnology/payment-contracts';

import { buildPlanCatalog } from './billing.plans';

describe('catalogo de planos', () => {
  test('a oferta da Hotmart sai do proprio link (`off`), e o catalogo passa na validacao da lib', () => {
    const plans = buildPlanCatalog({
      monthly: { hotmartCheckoutUrl: 'https://pay.hotmart.com/A1?off=mensal01' },
      yearly: { hotmartCheckoutUrl: 'https://pay.hotmart.com/A1?off=anual01' },
    });

    expect(planCatalogSchema.safeParse(plans).success).toBe(true);
    expect(plans.map((plan) => plan.offers.map((offer) => offer.offerCode))).toEqual([[], ['mensal01'], ['anual01']]);
  });

  test('link vazio ou sem `off` nao vira oferta; a falsa so entra quando pedida', () => {
    const plans = buildPlanCatalog({
      monthly: { hotmartCheckoutUrl: '', fakeOfferCode: 'mensal' },
      yearly: { hotmartCheckoutUrl: 'https://pay.hotmart.com/A1' },
    });

    expect(plans[1]?.offers).toEqual([
      { provider: 'fake', offerCode: 'mensal', checkoutUrl: 'https://pagamento.invalid/checkout?off=mensal' },
    ]);
    expect(plans[2]?.offers).toEqual([]);
  });
});
