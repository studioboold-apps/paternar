/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { accessEndsAt, plansToOffer } from '@/lib/subscription-plan';
import { useMySubscription } from '@/lib/use-subscription';

/**
 * A secao de plano decide aqui (`web.md` §4). O plano atual e' relido quando o
 * pai volta para a aba: e' assim que ele ve a compra feita no checkout.
 */
export function usePerfilPlan() {
  const mine = useMySubscription();
  const plans = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => api.entities.Subscription.plans(),
    staleTime: 5 * 60 * 1000,
  });

  const entitlement = mine.data;
  return {
    isLoading: mine.isLoading || plans.isLoading,
    hasFailed: Boolean(mine.error || plans.error),
    entitlement,
    endsAt: accessEndsAt(entitlement),
    offers: plansToOffer(plans.data, entitlement),
  };
}
