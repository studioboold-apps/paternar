/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';

import {
  SYMBOL_P_PATH,
  SYMBOL_SMILE_PATH,
  SYMBOL_SQUARE_PATH,
  SYMBOL_VIEWBOX,
} from '@/components/brand-art';
import { cn } from '@/lib/utils';

/**
 * O simbolo da marca Paternar (quadrado laranja com um "P" que sorri), com o
 * desenho oficial do designer. Quadrado, "P" e sorriso sao caminhos proprios,
 * para cada um poder se mover sozinho.
 *
 * `motion`:
 * - `enter`: o quadrado cresce, o "P" cai no lugar e o sorriso abre (abertura);
 * - `loop`:  o "P" balanca e o sorriso pulsa, sem parar (carregando);
 * - `none`:  parado.
 *
 * `--splash-elapsed` (negativo) continua a animacao de onde a abertura estatica
 * do `index.html` parou, quando o React assume a tela.
 */
export const BRAND_CREAM = '#F7F5EF';
export const BRAND_ORANGE = '#F18700';
export const BRAND_NAVY = '#2F3052';
const BRAND_WHITE = '#FFFFFF';

const MOTION_STYLES = `
  .brand-square, .brand-p, .brand-smile { transform-box: fill-box; transform-origin: center }
  .brand-p { transform-origin: 50% 100% }
  @keyframes brand-square-in { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.06); opacity: 1 } 100% { transform: none; opacity: 1 } }
  @keyframes brand-p-in { 0% { transform: translateY(-60%) rotate(-24deg); opacity: 0 } 60% { transform: translateY(4%) rotate(4deg); opacity: 1 } 100% { transform: none; opacity: 1 } }
  @keyframes brand-smile-in { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.25); opacity: 1 } 100% { transform: none; opacity: 1 } }
  @keyframes brand-p-rock { 0%, 100% { transform: rotate(0) } 30% { transform: rotate(-8deg) } 70% { transform: rotate(6deg) } }
  @keyframes brand-smile-pulse { 0%, 100% { transform: none } 50% { transform: scale(1.2) } }
  .brand-enter .brand-square { animation: brand-square-in 480ms cubic-bezier(.2,.8,.2,1) var(--splash-elapsed, 0ms) both }
  .brand-enter .brand-p { animation: brand-p-in 520ms cubic-bezier(.2,.8,.2,1) calc(180ms + var(--splash-elapsed, 0ms)) both }
  .brand-enter .brand-smile { animation: brand-smile-in 420ms ease-out calc(620ms + var(--splash-elapsed, 0ms)) both }
  .brand-loop .brand-p { animation: brand-p-rock 1400ms ease-in-out infinite }
  .brand-loop .brand-smile { animation: brand-smile-pulse 1400ms ease-in-out infinite }
  @media (prefers-reduced-motion: reduce) {
    .brand-enter *, .brand-loop * { animation: none !important }
  }
`;

export default function BrandMark({ motion = 'none', className }) {
  return (
    <svg
      viewBox={SYMBOL_VIEWBOX}
      aria-hidden="true"
      overflow="visible"
      className={cn('overflow-visible', motion === 'enter' && 'brand-enter', motion === 'loop' && 'brand-loop', className)}
    >
      {motion !== 'none' && <style>{MOTION_STYLES}</style>}
      <path className="brand-square" fill={BRAND_ORANGE} d={SYMBOL_SQUARE_PATH} />
      <g className="brand-p">
        <path fill={BRAND_WHITE} d={SYMBOL_P_PATH} />
        <path className="brand-smile" fill={BRAND_ORANGE} d={SYMBOL_SMILE_PATH} />
      </g>
    </svg>
  );
}
