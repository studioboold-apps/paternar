/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';

import {
  SYMBOL_P_PATH,
  SYMBOL_SMILE_PATH,
  SYMBOL_SQUARE_PATH,
  SYMBOL_VIEWBOX,
  WORDMARK_NAME_PATHS,
  WORDMARK_TAGLINE_PATHS,
  WORDMARK_VIEWBOX,
} from '@/components/brand-art';
import { cn } from '@/lib/utils';

const ORANGE = '#F18700';
const NAVY = '#2F3052';
const TAGLINE_GRAY = '#ACABA8';

/** O simbolo oficial: quadrado laranja com o "P" que sorri. */
export function BrandSymbol({ className }) {
  return (
    <svg viewBox={SYMBOL_VIEWBOX} aria-hidden="true" className={cn('block shrink-0', className)}>
      <path fill={ORANGE} d={SYMBOL_SQUARE_PATH} />
      <path fill="#FFFFFF" d={SYMBOL_P_PATH} />
      <path fill={ORANGE} d={SYMBOL_SMILE_PATH} />
    </svg>
  );
}

/** "Paternar" com PAI PRESENTE embaixo, em curvas (nao depende da fonte). */
export function BrandWordmark({ className }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} aria-hidden="true" className={cn('block', className)}>
      {WORDMARK_NAME_PATHS.map((d) => (
        <path key={d} fill={NAVY} d={d} />
      ))}
      {WORDMARK_TAGLINE_PATHS.map((d) => (
        <path key={d} fill={TAGLINE_GRAY} d={d} />
      ))}
    </svg>
  );
}
