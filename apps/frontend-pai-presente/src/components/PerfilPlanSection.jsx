/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O plano do pai e os planos que ele pode assinar. O pagamento acontece no
 * checkout do provedor, em outra aba; a volta para o app rele o plano.
 */

import React from 'react';
import { Check, Crown, ExternalLink } from 'lucide-react';

import PerfilPlanClaim from '@/components/PerfilPlanClaim';
import { usePerfilPlan } from '@/components/PerfilPlanSection.hook';
import { hasTranslation, useTranslation } from '@/lib/i18n';
import { checkoutUrlOf, knownFeatures } from '@/lib/subscription-plan';

export default function PerfilPlanSection() {
  const { t, locale } = useTranslation();
  const { isLoading, hasFailed, entitlement, endsAt, manageUrl, offers } = usePerfilPlan();
  const isKnownFeature = (feature) => hasTranslation(`planSection.features.${feature}`);

  if (isLoading || hasFailed || !entitlement) return null;

  return (
    <section className="px-4 mb-6" aria-labelledby="perfil-plan-title">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown aria-hidden="true" className="w-5 h-5 text-amber-400" />
          <h2 id="perfil-plan-title" className="font-medium text-zinc-100">
            {t('planSection.title')}
          </h2>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-100 font-medium">{entitlement.plan_name}</span>
          {entitlement.status === 'none' ? null : (
            <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-800 text-zinc-300">
              {t(`planSection.status.${entitlement.status}`)}
            </span>
          )}
        </div>
        {endsAt ? (
          <p className="text-sm text-zinc-400 mt-1">
            {t('planSection.accessUntil', { date: new Date(endsAt).toLocaleDateString(locale) })}
          </p>
        ) : null}
        {manageUrl ? (
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-400 underline underline-offset-2"
          >
            {t('planSection.manage')}
            <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
          </a>
        ) : null}

        {offers.map((plan) => (
          <div key={plan.code} className="mt-4 rounded-xl border border-zinc-800 p-4">
            <p className="font-medium text-zinc-100">{plan.name}</p>
            {plan.description ? <p className="text-sm text-zinc-400 mt-0.5">{plan.description}</p> : null}
            <ul className="mt-3 space-y-1">
              {knownFeatures(plan.features, isKnownFeature).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                  <Check aria-hidden="true" className="w-4 h-4 text-emerald-400" />
                  {t(`planSection.features.${feature}`)}
                </li>
              ))}
            </ul>
            <a
              href={checkoutUrlOf(plan)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              {t('planSection.subscribe')}
              <ExternalLink aria-hidden="true" className="w-4 h-4" />
            </a>
          </div>
        ))}
        {offers.length > 0 ? <p className="text-xs text-zinc-500 mt-3">{t('planSection.checkoutHint')}</p> : null}
        {entitlement.has_access ? null : <PerfilPlanClaim />}
      </div>
    </section>
  );
}
