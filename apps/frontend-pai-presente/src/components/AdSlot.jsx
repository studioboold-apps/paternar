/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React, { useEffect, useRef } from 'react';

import { advertisingConfig, buildAdsenseScriptUrl } from '@/lib/advertising';
import { useTranslation } from '@/lib/i18n';
import { loadScript } from '@/lib/load-script';
import { SUBSCRIPTION_FEATURES, useHasFeature } from '@/lib/use-subscription';

/**
 * Um bloco de anuncio discreto, rotulado como publicidade (exigencia do Google
 * e do CONAR). Sem os ids no build, nao desenha nada — nem o espaco.
 *
 * O `push` acontece uma vez por `<ins>`: repetir no mesmo elemento e' erro do
 * `adsbygoogle.js` ("All ins elements already have ads"). Script que nao
 * carrega (bloqueador de anuncio) nao e' erro do pai: o bloco so fica vazio.
 *
 * Assinante com "sem anuncios" nao ve o bloco, e o script do Google nem e'
 * carregado para ele. Enquanto o plano nao chega, nada e' desenhado.
 */
export default function AdSlot({ className = '' }) {
  const { t } = useTranslation();
  const slotRef = useRef(null);
  const hidesAds = useHasFeature(SUBSCRIPTION_FEATURES.NO_ADS);
  const { clientId, slotId, testMode } = advertisingConfig;
  const enabled = advertisingConfig.enabled && hidesAds === false;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadScript(buildAdsenseScriptUrl(clientId))
      .then(() => {
        const element = slotRef.current;
        if (cancelled || !element || element.dataset.adsbygoogleStatus) return;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, clientId]);

  if (!enabled) return null;

  return (
    <aside aria-label={t('common.advertising')} className={`my-6 ${className}`}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{t('common.advertising')}</p>
      <ins
        ref={slotRef}
        className="adsbygoogle block overflow-hidden rounded-xl"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(testMode ? { 'data-adtest': 'on' } : {})}
      />
    </aside>
  );
}
