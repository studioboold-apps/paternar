/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(import.meta.dir, 'PerfilPlanSection.jsx'), 'utf8');

describe('PerfilPlanSection', () => {
  it('a tela desenha e o hook decide: nada de estado nem API aqui', () => {
    expect(SOURCE).toContain("from '@/components/PerfilPlanSection.hook'");
    expect(SOURCE).not.toContain('useState');
    expect(SOURCE).not.toContain('api.');
  });

  it('o checkout abre em outra aba sem dar acesso a esta (noopener)', () => {
    expect(SOURCE).toContain('target="_blank"');
    expect(SOURCE).toContain('rel="noopener noreferrer"');
  });

  it('icones decorativos declaram aria-hidden', () => {
    const icons = SOURCE.match(/<(Check|Crown|ExternalLink)\b[^>]*>/g) ?? [];
    expect(icons.length).toBe(3);
    for (const icon of icons) expect(icon).toContain('aria-hidden="true"');
  });

  it('nenhum texto cravado entre tags', () => {
    expect(/>[ \t]*[A-Za-zÀ-ú][^<>{}]{2,}</.test(SOURCE)).toBe(false);
  });
});
