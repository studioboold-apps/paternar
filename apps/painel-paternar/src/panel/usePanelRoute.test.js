/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { parseRoute, routeHref } from './usePanelRoute';

describe('endereco das telas do painel', () => {
  test('secao e id saem do hash', () => {
    expect(parseRoute('#/pais/abc-123')).toEqual({ section: 'pais', id: 'abc-123' });
    expect(parseRoute('#/denuncias')).toEqual({ section: 'denuncias', id: '' });
    expect(parseRoute('')).toEqual({ section: '', id: '' });
  });

  test('ida e volta preservam o id', () => {
    expect(parseRoute(routeHref('pais', 'a/b'))).toEqual({ section: 'pais', id: 'a/b' });
  });
});
