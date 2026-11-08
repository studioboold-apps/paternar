/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { formatPercent, formatRelative, formatUsd } from './panel-format';

describe('formatos do painel', () => {
  test('custo em milionesimos de dolar vira dolar legivel', () => {
    expect(formatUsd(100_000)).toBe('US$ 0,10');
    expect(formatUsd(1_234)).toBe('US$ 0,0012');
    expect(formatUsd(12_500_000)).toBe('US$ 12,50');
    expect(formatUsd(0)).toBe('US$ 0,00');
  });

  test('percentual sem base vira traco, nao NaN', () => {
    expect(formatPercent(1, 0)).toBe('—');
    expect(formatPercent(1, 4)).toBe('25%');
  });

  test('ultimo acesso relativo', () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    expect(formatRelative(null, now)).toBe('nunca');
    expect(formatRelative('2026-11-08T11:30:00Z', now)).toBe('há 30 min');
    expect(formatRelative('2026-11-05T12:00:00Z', now)).toBe('há 3 dias');
  });
});
