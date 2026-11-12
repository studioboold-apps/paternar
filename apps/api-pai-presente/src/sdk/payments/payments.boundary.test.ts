/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O SDK nao importa nada do app: e' o que deixa ele virar pacote proprio e
 * receber outro provedor sem tocar em banco nem em rota.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { expect, test } from 'bun:test';

function listSourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

test('o SDK de pagamentos so importa a si mesmo e o node', () => {
  const root = import.meta.dir;
  const offenders = listSourceFiles(root).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)]
      .map((match) => match[1] ?? '')
      .filter((source) => {
        if (source.startsWith('node:')) return false;
        if (!source.startsWith('.')) return true;
        return !resolve(dirname(file), source).startsWith(root);
      })
      .map((source) => `${file}: ${source}`),
  );
  expect(offenders).toEqual([]);
});
