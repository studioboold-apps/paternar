/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O convite para assinar quando algo nao cabe no plano. Gentil de proposito:
 * diz o que aconteceu, quando libera de novo e onde assinar, sem tom de erro.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { PLAN_LOCKS } from '@/lib/use-plan';
import { createPageUrl } from '@/utils';

/** Assinante que gastou demais nao e' convidado a assinar de novo: recebe o aviso de uso justo. */
const isSubscriberLevel = (level) => level === 'economy' || level === 'limited';

/**
 * @param {{ lock: string, level?: string | null, resetsAt?: string | null, className?: string }} props
 */
export default function PlanUpsell({ lock, level = null, resetsAt = null, className = '' }) {
  const { t, locale } = useTranslation();
  const audience = isSubscriberLevel(level) ? 'subscriber' : 'free';
  const date = resetsAt ? new Date(resetsAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) : null;

  return (
    <div role="status" className={`rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-1">
          <p className="font-medium text-zinc-100">{t(`planUpsell.${audience}.${lock}.title`)}</p>
          <p className="text-sm text-zinc-300">{t(`planUpsell.${audience}.${lock}.body`)}</p>
          {date && lock === PLAN_LOCKS.CHAT_LIMIT ? (
            <p className="text-sm text-zinc-400">{t('planUpsell.resetsAt', { date })}</p>
          ) : null}
        </div>
      </div>
      {audience === 'free' ? (
        <Button asChild className="mt-3 w-full">
          <Link to={createPageUrl('Perfil')}>{t('planUpsell.cta')}</Link>
        </Button>
      ) : null}
    </div>
  );
}
