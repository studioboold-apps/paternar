/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  readAiEnvironment,
  readDatabaseEnvironment,
  readEnvironment,
} from './environment';

const DATABASE_ONLY = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };

/** O minimo que o servidor precisa para subir — de proposito, SEM chave de IA. */
const BOOT_WITHOUT_AI_KEY = {
  ...DATABASE_ONLY,
  AUTH_JWT_SECRET: 'segredo_local_de_teste_com_mais_de_32',
  LLM_PROVIDER: 'anthropic',
};

describe('fatias de ambiente', () => {
  /**
   * O defeito medido em 05/09/2026: `bun run db:migrate` morria com
   * `ZodError: LLM_API_KEY`. Criar tabela nao gera texto nenhum.
   */
  test('criar tabela nao exige chave de IA', () => {
    expect(readDatabaseEnvironment(DATABASE_ONLY).DATABASE_URL).toBe(
      DATABASE_ONLY.DATABASE_URL,
    );
  });

  test('quem gera texto continua exigindo o PROVEDOR', () => {
    expect(() => readAiEnvironment(DATABASE_ONLY)).toThrow();
  });

  /**
   * Defeito medido em 05/09/2026: `make dev` subia a web e NAO a API —
   * `ZodError: LLM_API_KEY` no boot, porque `envs/env.dev` deixa a chave para o
   * `env.dev.local` que ninguem tem ainda. Chave de IA ausente e falta de um
   * RECURSO, nao configuracao invalida: quem pedir texto recebe 503 legivel
   * (mesmo trato do login sem provedor), e o resto do produto continua de pe.
   */
  test('o boot sobrevive sem chave de IA', () => {
    expect(readEnvironment(BOOT_WITHOUT_AI_KEY).LLM_API_KEY).toBe('');
  });

  test('o boot do servidor exige tudo de uma vez', () => {
    expect(() => readEnvironment(DATABASE_ONLY)).toThrow();
  });
});

describe('acoplamento de boot', () => {
  /**
   * Uma fatia so protege enquanto ninguem volta a pedir o pacote inteiro: o
   * defeito nao reaparece como erro de tipo, so como boot que morre.
   */
  test.each([
    ['../database/migrate.ts', 'readDatabaseEnvironment'],
    ['../main.ts', 'readEnvironment'],
  ])('%s le so a fatia dele', (relativePath, expectedReader) => {
    const source = readFileSync(join(import.meta.dir, relativePath), 'utf8');

    expect(source).toContain(expectedReader);
    expect(source).not.toMatch(/import \{ environment \}/);
  });
});

describe('recuperacao do admin do painel', () => {
  test('flag com aspas ou escrita por extenso nao derruba o boot', () => {
    expect(readEnvironment({ ...BOOT_WITHOUT_AI_KEY, PANEL_ADMIN_RESET: '"1"' }).PANEL_ADMIN_RESET).toBe(true);
    expect(readEnvironment({ ...BOOT_WITHOUT_AI_KEY, PANEL_ADMIN_RESET: 'true' }).PANEL_ADMIN_RESET).toBe(true);
    expect(readEnvironment({ ...BOOT_WITHOUT_AI_KEY, PANEL_ADMIN_RESET: '0' }).PANEL_ADMIN_RESET).toBe(false);
    expect(readEnvironment(BOOT_WITHOUT_AI_KEY).PANEL_ADMIN_RESET).toBe(true);
  });

  test('senha de admin curta nao impede a API de subir', () => {
    expect(() => readEnvironment({ ...BOOT_WITHOUT_AI_KEY, PANEL_ADMIN_PASSWORD: 'curta' })).not.toThrow();
  });
});
