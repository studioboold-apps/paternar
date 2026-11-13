/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O plano do pai, lido uma vez e compartilhado (mesma chave de cache) por quem
 * precisa: a secao de plano do Perfil e o bloco de anuncio.
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';

export const SUBSCRIPTION_FEATURES = Object.freeze({ NO_ADS: 'sem_anuncios' });

/** Relido quando o pai volta para a aba: e' assim que a compra feita no checkout aparece. */
export function useMySubscription() {
  return useQuery({
    queryKey: ['subscription', 'mine'],
    queryFn: () => api.entities.Subscription.mine(),
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  });
}

/**
 * `undefined` enquanto carrega. Quem esconde algo por plano espera a resposta:
 * mostrar o anuncio e tira-lo um instante depois e' pior que esperar.
 */
export function useHasFeature(feature) {
  const { data, isError } = useMySubscription();
  if (isError) return false;
  if (!data) return undefined;
  return (data.features ?? []).includes(feature);
}
