/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { TEST_USER } from '../../testing/http-test.util';
import { ACCESS_COOKIE_NAME } from './auth.constant';
import { createCookieSessionResolver } from './session.resolver';
import { createTokenService } from './token.service';

const JWT_SECRET = 'segredo_de_teste_com_mais_de_32_caracteres';
const OTHER_SECRET = 'outro_segredo_de_teste_com_mais_de_32_caracteres';
const NOBODY_BLOCKED = { isBlocked: async () => false };

function buildRequest(headers: Readonly<Record<string, string>>): Request {
  return new Request('http://localhost/v1/children', { headers });
}

describe('sessao pelo cookie', () => {
  test('reconhece o dono do token de acesso', async () => {
    const tokenService = createTokenService(JWT_SECRET);
    const accessToken = await tokenService.mintAccessToken(TEST_USER);

    const resolved = await createCookieSessionResolver(tokenService, NOBODY_BLOCKED).resolve(
      buildRequest({ Cookie: `${ACCESS_COOKIE_NAME}=${accessToken}` }),
    );

    expect(resolved).toEqual(TEST_USER);
  });

  test('token assinado por outra chave nao vale', async () => {
    const foreignToken = await createTokenService(OTHER_SECRET).mintAccessToken(TEST_USER);

    const resolved = await createCookieSessionResolver(createTokenService(JWT_SECRET), NOBODY_BLOCKED).resolve(
      buildRequest({ Cookie: `${ACCESS_COOKIE_NAME}=${foreignToken}` }),
    );

    expect(resolved).toBeUndefined();
  });

  test('Authorization: Bearer NAO e aceito', async () => {
    const tokenService = createTokenService(JWT_SECRET);
    const accessToken = await tokenService.mintAccessToken(TEST_USER);

    // Aceitar o cabecalho devolveria ao frontend um caminho para guardar o
    // token em localStorage — exatamente o que o ADR-001 §2.1 proibe.
    const resolved = await createCookieSessionResolver(tokenService, NOBODY_BLOCKED).resolve(
      buildRequest({ Authorization: `Bearer ${accessToken}` }),
    );

    expect(resolved).toBeUndefined();
  });

  test('pai bloqueado pelo painel perde a sessao na hora, mesmo com token valido', async () => {
    const tokenService = createTokenService(JWT_SECRET);
    const accessToken = await tokenService.mintAccessToken(TEST_USER);
    const blocked = { isBlocked: async (userId: string) => userId === TEST_USER.userId };

    const resolved = await createCookieSessionResolver(tokenService, blocked).resolve(
      buildRequest({ Cookie: `${ACCESS_COOKIE_NAME}=${accessToken}` }),
    );

    expect(resolved).toBeUndefined();
  });

  test('sem cookie nenhum, ninguem e reconhecido', async () => {
    const resolved = await createCookieSessionResolver(createTokenService(JWT_SECRET), NOBODY_BLOCKED).resolve(
      buildRequest({}),
    );

    expect(resolved).toBeUndefined();
  });
});
