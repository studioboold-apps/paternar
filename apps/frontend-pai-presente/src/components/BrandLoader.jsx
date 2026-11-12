/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';

import BrandMark from '@/components/BrandMark';
import { cn } from '@/lib/utils';

/**
 * Espera dentro do app (transicoes, IA pensando): o "P" da marca balanca e
 * sorri, no lugar do spinner generico.
 */
export default function BrandLoader({ label, size = 'md', className }) {
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <BrandMark motion="loop" className={size === 'sm' ? 'h-6 w-6' : 'h-12 w-12'} />
      {label ? <p className="text-zinc-500 text-sm">{label}</p> : <span className="sr-only">…</span>}
    </div>
  );
}
