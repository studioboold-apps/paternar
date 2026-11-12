/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';

import { WORDMARK_NAME_PATHS, WORDMARK_TAGLINE_PATHS, WORDMARK_VIEWBOX } from '@/components/brand-art';
import { BRAND_CREAM, BRAND_NAVY } from '@/components/BrandMark';
import { cn } from '@/lib/utils';

const TAGLINE_GRAY = '#ACABA8';

/**
 * "Paternar" com PAI PRESENTE embaixo: o desenho oficial do
 * logotipo (em curvas, entao nao depende da fonte da marca estar carregada).
 * Fica escondido do leitor de tela: quem usa poe o nome num titulo `sr-only`.
 * `tone` diz o fundo: `dark` (marinho) ou `light`.
 */
export default function BrandWordmark({ tone = 'light', size = 'md', className }) {
  const nameColor = tone === 'dark' ? BRAND_CREAM : BRAND_NAVY;
  return (
    <svg
      aria-hidden="true"
      viewBox={WORDMARK_VIEWBOX}
      className={cn('block', size === 'lg' ? 'h-16 w-[197px]' : 'h-12 w-[148px]', className)}
    >
      {WORDMARK_NAME_PATHS.map((d) => (
        <path key={d} fill={nameColor} d={d} />
      ))}
      {WORDMARK_TAGLINE_PATHS.map((d) => (
        <path key={d} fill={TAGLINE_GRAY} d={d} />
      ))}
    </svg>
  );
}
