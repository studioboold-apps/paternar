/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Comprei e o plano nao apareceu": o pai informa o codigo da compra que veio
 * no e-mail da Hotmart. Acontece quando a compra foi feita fora do app e com
 * outro e-mail.
 */

import React from 'react';

import { usePerfilPlanClaim } from '@/components/PerfilPlanClaim.hook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';

export default function PerfilPlanClaim() {
  const { t } = useTranslation();
  const claim = usePerfilPlanClaim();

  if (!claim.isOpen) {
    return (
      <button type="button" onClick={claim.open} className="mt-4 text-sm text-amber-500 underline underline-offset-2">
        {t('planSection.claim.open')}
      </button>
    );
  }

  return (
    <form onSubmit={claim.submit} className="mt-4 space-y-2">
      <label htmlFor="perfil-plan-claim" className="block text-sm text-zinc-300">
        {t('planSection.claim.label')}
      </label>
      <p className="text-xs text-zinc-500">{t('planSection.claim.hint')}</p>
      <Input
        id="perfil-plan-claim"
        value={claim.code}
        onChange={(event) => claim.setCode(event.target.value)}
        placeholder={t('planSection.claim.placeholder')}
        autoComplete="off"
        autoCapitalize="characters"
        aria-invalid={claim.failureKey ? 'true' : 'false'}
        aria-describedby={claim.failureKey ? 'perfil-plan-claim-error' : undefined}
      />
      {claim.failureKey ? (
        <p id="perfil-plan-claim-error" role="alert" className="text-sm text-red-500">
          {t(`planSection.claim.failure.${claim.failureKey}`)}
        </p>
      ) : null}
      <Button type="submit" disabled={!claim.canSubmit} className="w-full">
        {claim.isPending ? t('planSection.claim.submitting') : t('planSection.claim.submit')}
      </Button>
    </form>
  );
}
