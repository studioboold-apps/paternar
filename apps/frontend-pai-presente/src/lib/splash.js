/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useEffect, useState } from 'react';

/** Tempo da animacao inteira do `BrandSplash`: quadrado, "P", sorriso e nome. */
export const SPLASH_MIN_DURATION_MS = 1300;
const SPLASH_SEEN_KEY = 'entrelacos:splash-seen';

/**
 * Quanto tempo a abertura estatica do `index.html` ja' rodou (ela grava o
 * instante em `window.__splashStartedAt`). Zero quando nao houve.
 */
export function splashElapsedMs() {
  const startedAt = globalThis.window?.__splashStartedAt;
  if (typeof startedAt !== 'number') return 0;
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function hasSeenSplash() {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSplashSeen() {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
  } catch {
    // aba anonima sem storage: a abertura so' repete, nada quebra
  }
}

/**
 * A abertura toca inteira UMA vez por aba: na primeira carga ela segura a tela
 * pelo tempo da animacao mesmo que o login resolva antes; num recarregar da
 * mesma aba ela so' aparece enquanto o app de fato carrega.
 */
export function useSplashGate(isLoading) {
  const [isHolding, setIsHolding] = useState(() => !hasSeenSplash());

  useEffect(() => {
    if (!isHolding) return undefined;
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - splashElapsedMs());
    const timer = setTimeout(() => {
      markSplashSeen();
      setIsHolding(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [isHolding]);

  return isLoading || isHolding;
}
