/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { groupReports } from './panel-actions';

const report = (id, targetType, postId, commentId) => ({ id, targetType, postId, commentId });

describe('fila de denuncias', () => {
  test('denuncias do mesmo conteudo viram um cartao, na ordem em que chegaram', () => {
    const groups = groupReports([
      report('a', 'post', 'p1', null),
      report('b', 'comment', 'p1', 'c1'),
      report('c', 'post', 'p1', null),
    ]);
    expect(groups.map((group) => group.reports.map((entry) => entry.id))).toEqual([['a', 'c'], ['b']]);
  });

  test('conteudo ja removido (sem vinculo) nao junta denuncias diferentes', () => {
    const groups = groupReports([report('a', 'post', null, null), report('b', 'post', null, null)]);
    expect(groups).toHaveLength(2);
  });
});
