/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { accessEndsAt, checkoutUrlOf, knownFeatures, plansToOffer } from '@/lib/subscription-plan';

const FREE = { code: 'gratuito', is_free: true, checkouts: [] };
const MONTHLY = { code: 'premium_mensal', is_free: false, checkouts: [{ provider: 'hotmart', url: 'https://pay.hotmart.com/A?off=m&xcod=u1' }] };
const YEARLY = { code: 'premium_anual', is_free: false, checkouts: [] };

describe('plano do pai', () => {
  test('oferece so plano pago com link, e nunca o que o pai ja tem', () => {
    expect(plansToOffer([FREE, MONTHLY, YEARLY], { plan_code: 'gratuito', has_access: false })).toEqual([MONTHLY]);
    expect(plansToOffer([FREE, MONTHLY], { plan_code: 'premium_mensal', has_access: true })).toEqual([]);
  });

  test('assinatura vencida volta a oferecer o mesmo plano', () => {
    expect(plansToOffer([MONTHLY], { plan_code: 'premium_mensal', has_access: false })).toEqual([MONTHLY]);
  });

  test('a data so aparece quando o acesso acaba nela', () => {
    const end = '2026-12-10T10:00:00.000Z';
    expect(accessEndsAt({ has_access: true, status: 'canceled', period_ends_at: end })).toBe(end);
    expect(accessEndsAt({ has_access: true, status: 'active', period_ends_at: end })).toBeNull();
    expect(accessEndsAt({ has_access: false, status: 'canceled', period_ends_at: end })).toBeNull();
  });

  test('checkout e recursos', () => {
    expect(checkoutUrlOf(MONTHLY)).toBe('https://pay.hotmart.com/A?off=m&xcod=u1');
    expect(checkoutUrlOf(YEARLY)).toBeNull();
    expect(knownFeatures(['ia_ilimitada', 'novo'], (feature) => feature === 'ia_ilimitada')).toEqual(['ia_ilimitada']);
  });
});
