/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { claimFailureKey, normalizeTransactionCode } from '@/lib/subscription-plan';

/**
 * Resgate de compra feita fora do app (`web.md` §4: a tela so desenha). Deu
 * certo, o plano novo entra direto no cache que o Perfil e o anuncio leem.
 */
export function usePerfilPlanClaim() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');

  const claim = useMutation({
    mutationFn: (/** @type {string} */ transactionId) => api.entities.Subscription.claim(transactionId),
    onSuccess: (entitlement) => {
      queryClient.setQueryData(['subscription', 'mine'], entitlement);
      setCode('');
      setIsOpen(false);
    },
  });

  const normalized = normalizeTransactionCode(code);
  return {
    isOpen,
    open: () => setIsOpen(true),
    code,
    setCode: (value) => {
      setCode(value);
      if (claim.isError) claim.reset();
    },
    canSubmit: normalized.length >= 4 && !claim.isPending,
    submit: (event) => {
      event.preventDefault();
      if (normalized.length >= 4) claim.mutate(normalized);
    },
    isPending: claim.isPending,
    failureKey: claim.isError ? claimFailureKey(claim.error) : null,
  };
}
