/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_METHODS, HTTP_STATUS } from '../shared/http/http.constant';
import {
  createFakeAccountRepository,
  createFakePasswordAccountRepository,
  createFakePasswordHasher,
  createFakeSessionRepository,
  createFakeVerifierRegistry,
  VALID_GOOGLE_TOKEN,
  type FakeAccountRepository,
  type FakeSessionRepository,
} from '../../testing/auth-fakes';
import {
  createTestClient,
  readDataRecord,
  readErrorCode,
  type TestClient,
  type TestResponse,
} from '../../testing/http-test.util';
import { createRateLimiter } from '../shared/http/rate-limit';
import {
  ACCESS_COOKIE_NAME,
  PASSWORD_SIGN_IN_RATE_LIMIT,
  REFRESH_COOKIE_NAME,
  REGISTRATIONS_PATH,
  SESSIONS_PATH,
  type AuthProvider,
} from './auth.constant';
import { buildAuthRoutes } from './auth.controller';
import { createAuthUseCases } from './auth.use-case';
import { createTokenService } from './token.service';

const JWT_SECRET = 'segredo_de_teste_com_mais_de_32_caracteres';

type Harness = {
  readonly client: TestClient;
  readonly sessions: FakeSessionRepository;
  readonly accounts: FakeAccountRepository;
};

type HarnessOptions = {
  readonly isPasswordSignInEnabled?: boolean;
};

function createHarness({ isPasswordSignInEnabled = true }: HarnessOptions = {}): Harness {
  const sessions = createFakeSessionRepository();
  const accounts = createFakeAccountRepository();
  const useCases = createAuthUseCases({
    verifiers: createFakeVerifierRegistry(),
    accounts,
    passwordAccounts: createFakePasswordAccountRepository(),
    passwordHasher: createFakePasswordHasher(),
    isPasswordSignInEnabled,
    sessions,
    tokenService: createTokenService(JWT_SECRET),
  });
  const client = createTestClient({
    routes: [],
    publicRoutes: buildAuthRoutes({
      useCases,
      isSecureCookie: true,
      // Um limitador POR HARNESS: compartilhar um so faria o teste seguinte
      // herdar a cota gasta pelo anterior, e a suite falharia pela ordem.
      signInRateLimiter: createRateLimiter(PASSWORD_SIGN_IN_RATE_LIMIT),
    }),
    user: undefined,
  });
  return { client, sessions, accounts };
}

const EMAIL = 'pai.senha@example.com';
const PASSWORD = 'senha-comprida-de-teste';

function register(
  client: TestClient,
  body: Readonly<Record<string, unknown>> = { email: EMAIL, password: PASSWORD, fullName: 'Pai Senha' },
): Promise<TestResponse> {
  return client.send({ method: HTTP_METHODS.POST, path: REGISTRATIONS_PATH, body });
}

function signInWithPassword(
  client: TestClient,
  body: Readonly<Record<string, unknown>> = { provider: 'password', email: EMAIL, password: PASSWORD },
): Promise<TestResponse> {
  return client.send({ method: HTTP_METHODS.POST, path: SESSIONS_PATH, body });
}

function readSetCookies(response: TestResponse): readonly string[] {
  return response.headers.getSetCookie();
}

function findCookie(response: TestResponse, name: string): string {
  const cookie = readSetCookies(response).find((value) => value.startsWith(`${name}=`));
  if (cookie === undefined) throw new Error(`resposta sem cookie ${name}`);
  return cookie;
}

function readCookieValue(response: TestResponse, name: string): string {
  const raw = findCookie(response, name);
  const value = raw.slice(name.length + 1, raw.indexOf(';'));
  return decodeURIComponent(value);
}

function signIn(client: TestClient, provider: AuthProvider = 'google'): Promise<TestResponse> {
  return client.send({
    method: HTTP_METHODS.POST,
    path: SESSIONS_PATH,
    body: { provider, idToken: VALID_GOOGLE_TOKEN },
  });
}

function withRefreshCookie(response: TestResponse): Readonly<Record<string, string>> {
  return { Cookie: `${REFRESH_COOKIE_NAME}=${readCookieValue(response, REFRESH_COOKIE_NAME)}` };
}

describe('rotas de sessao', () => {
  test('o login devolve os dois tokens SO em Set-Cookie', async () => {
    const { client } = createHarness();

    const response = await signIn(client);

    expect(response.status).toBe(HTTP_STATUS.CREATED);
    const accessToken = readCookieValue(response, ACCESS_COOKIE_NAME);
    const refreshToken = readCookieValue(response, REFRESH_COOKIE_NAME);
    // O aceite do TB.6: o token nao pode existir em nenhum lugar que o
    // JavaScript da pagina alcance — nem no corpo, nem na URL.
    const body = JSON.stringify(response.payload);
    expect(body).not.toContain(accessToken);
    expect(body).not.toContain(refreshToken);
    expect(SESSIONS_PATH).not.toContain(accessToken);
    expect(readDataRecord(response).user).toMatchObject({ email: 'pai@example.com' });
  });

  test('os cookies sao HttpOnly, Secure e SameSite', async () => {
    const { client } = createHarness();

    const response = await signIn(client);

    for (const name of [ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME]) {
      const cookie = findCookie(response, name);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
    }
    // O refresh so viaja na rota que o usa; o de acesso vai em toda chamada.
    expect(findCookie(response, REFRESH_COOKIE_NAME)).toContain('Path=/v1/auth');
    expect(findCookie(response, ACCESS_COOKIE_NAME)).toContain('Path=/');
  });

  test('id_token recusado nao abre sessao nem devolve cookie', async () => {
    const { client } = createHarness();

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: SESSIONS_PATH,
      body: { provider: 'google', idToken: 'lixo' },
    });

    expect(response.status).toBe(401);
    expect(readErrorCode(response)).toBe(ERROR_CODES.auth.IDENTITY_TOKEN_INVALID);
    expect(readSetCookies(response)).toHaveLength(0);
  });

  test('provedor sem configuracao responde 503, e nao 401', async () => {
    const { client } = createHarness();

    const response = await signIn(client, 'apple');

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(readErrorCode(response)).toBe(ERROR_CODES.auth.PROVIDER_NOT_CONFIGURED);
  });

  test('provedor fora da lista e recusado na fronteira', async () => {
    const { client } = createHarness();

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: SESSIONS_PATH,
      body: { provider: 'facebook', idToken: VALID_GOOGLE_TOKEN },
    });

    expect(response.status).toBe(400);
    expect(readErrorCode(response)).toBe(ERROR_CODES.shared.VALIDATION_FAILED);
  });

  test('entrar duas vezes pelo mesmo provedor nao cria segunda conta', async () => {
    const { client } = createHarness();

    const first = readDataRecord(await signIn(client)).user;
    const second = readDataRecord(await signIn(client)).user;

    expect(second).toEqual(first);
  });
});

describe('rotacao do refresh', () => {
  test('o PUT troca o refresh e o anterior deixa de valer', async () => {
    const { client } = createHarness();
    const login = await signIn(client);

    const rotated = await client.send({
      method: HTTP_METHODS.PUT,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(login),
    });
    expect(rotated.status).toBe(HTTP_STATUS.OK);
    expect(readCookieValue(rotated, REFRESH_COOKIE_NAME)).not.toBe(
      readCookieValue(login, REFRESH_COOKIE_NAME),
    );

    const reused = await client.send({
      method: HTTP_METHODS.PUT,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(login),
    });
    expect(reused.status).toBe(401);
    expect(readErrorCode(reused)).toBe(ERROR_CODES.auth.REFRESH_TOKEN_INVALID);
  });

  test('reapresentar refresh revogado derruba TODAS as sessoes do usuario', async () => {
    const { client, sessions } = createHarness();
    const login = await signIn(client);
    const rotated = await client.send({
      method: HTTP_METHODS.PUT,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(login),
    });
    expect(sessions.countLiveSessions()).toBe(1);

    // Refresh usado duas vezes so acontece com copia: a sessao viva pode ser a
    // do ladrao, entao derruba-se tudo e o dono entra de novo.
    await client.send({
      method: HTTP_METHODS.PUT,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(login),
    });

    expect(sessions.countLiveSessions()).toBe(0);
    const afterTheft = await client.send({
      method: HTTP_METHODS.PUT,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(rotated),
    });
    expect(afterTheft.status).toBe(401);
  });

  test('PUT sem cookie nenhum responde 401', async () => {
    const { client } = createHarness();

    const response = await client.send({ method: HTTP_METHODS.PUT, path: SESSIONS_PATH });

    expect(response.status).toBe(401);
    expect(readErrorCode(response)).toBe(ERROR_CODES.auth.REFRESH_TOKEN_INVALID);
  });
});

describe('saida', () => {
  test('o DELETE apaga os dois cookies e revoga a sessao', async () => {
    const { client, sessions } = createHarness();
    const login = await signIn(client);

    const response = await client.send({
      method: HTTP_METHODS.DELETE,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(login),
    });

    expect(response.status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(sessions.countLiveSessions()).toBe(0);
    for (const name of [ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME]) {
      expect(findCookie(response, name)).toContain('Max-Age=0');
    }
  });

  test('sair sem cookie ainda apaga os cookies do navegador', async () => {
    const { client } = createHarness();

    const response = await client.send({ method: HTTP_METHODS.DELETE, path: SESSIONS_PATH });

    expect(response.status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(readSetCookies(response)).toHaveLength(2);
  });
});

describe('cadastro e entrada por e-mail e senha', () => {
  test('o cadastro abre a sessao na hora, com os dois cookies', async () => {
    const { client } = createHarness();

    const response = await register(client);

    expect(response.status).toBe(HTTP_STATUS.CREATED);
    expect(readDataRecord(response).user).toMatchObject({ email: EMAIL });
    expect(readSetCookies(response)).toHaveLength(2);
  });

  test('e-mail repetido responde 409, e nao 500 nem conta duplicada', async () => {
    const { client } = createHarness();
    await register(client);

    const response = await register(client);

    expect(response.status).toBe(HTTP_STATUS.CONFLICT);
    expect(readErrorCode(response)).toBe(ERROR_CODES.auth.EMAIL_ALREADY_REGISTERED);
    expect(readSetCookies(response)).toHaveLength(0);
  });

  /** O e-mail e' normalizado ANTES de validar, entao a maiuscula colide. */
  test('o mesmo e-mail em outra caixa e o mesmo e-mail', async () => {
    const { client } = createHarness();
    await register(client);

    const response = await register(client, { email: EMAIL.toUpperCase(), password: PASSWORD });

    expect(response.status).toBe(HTTP_STATUS.CONFLICT);
  });

  test('senha curta e barrada na fronteira, antes de virar conta', async () => {
    const { client } = createHarness();

    const response = await register(client, { email: 'curta@example.com', password: 'curta' });

    expect(response.status).toBe(400);
    expect(readErrorCode(response)).toBe(ERROR_CODES.shared.VALIDATION_FAILED);
  });

  test('quem se cadastrou entra depois com a mesma senha', async () => {
    const { client } = createHarness();
    const created = readDataRecord(await register(client)).user;

    const response = await signInWithPassword(client);

    expect(response.status).toBe(HTTP_STATUS.CREATED);
    expect(readDataRecord(response).user).toEqual(created);
  });

  /**
   * Senha errada e e-mail que nao existe devolvem a MESMA recusa: distinguir
   * as duas conta a quem tentar quais e-mails tem conta neste banco.
   */
  test('senha errada e e-mail desconhecido dao a mesma resposta', async () => {
    const { client } = createHarness();
    await register(client);

    const wrongPassword = await signInWithPassword(client, {
      provider: 'password',
      email: EMAIL,
      password: 'senha-errada-porem-longa',
    });
    const unknownEmail = await signInWithPassword(client, {
      provider: 'password',
      email: 'ninguem@example.com',
      password: PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(readErrorCode(wrongPassword)).toBe(ERROR_CODES.auth.IDENTITY_TOKEN_INVALID);
    expect(readErrorCode(unknownEmail)).toBe(readErrorCode(wrongPassword));
    expect(readSetCookies(wrongPassword)).toHaveLength(0);
  });

  /**
   * Quem entrou por Google nao tem senha guardada. A tentativa cai na mesma
   * recusa vaga — dizer "essa conta e do Google" confirmaria que ela existe.
   */
  test('conta que entrou por Google nao vira porta de senha', async () => {
    const { client } = createHarness();
    await signIn(client);

    const response = await signInWithPassword(client, {
      provider: 'password',
      email: 'pai@example.com',
      password: PASSWORD,
    });

    expect(response.status).toBe(401);
    expect(readErrorCode(response)).toBe(ERROR_CODES.auth.IDENTITY_TOKEN_INVALID);
  });

  test('a tentativa em rajada esbarra no limite por e-mail', async () => {
    const { client } = createHarness();
    const attempts = PASSWORD_SIGN_IN_RATE_LIMIT.maxRequests + 1;

    let last: TestResponse | undefined;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      last = await signInWithPassword(client, {
        provider: 'password',
        email: EMAIL,
        password: 'senha-errada-porem-longa',
      });
    }

    expect(last?.status).toBe(429);
    expect(last === undefined ? undefined : readErrorCode(last)).toBe(ERROR_CODES.shared.TOO_MANY_REQUESTS);
  });

  /** O limite e' POR E-MAIL: quem chuta uma conta nao tranca a do vizinho. */
  test('a rajada num e-mail nao tranca a porta de outro', async () => {
    const { client } = createHarness();
    await register(client, { email: 'vizinho@example.com', password: PASSWORD });
    for (let attempt = 0; attempt <= PASSWORD_SIGN_IN_RATE_LIMIT.maxRequests; attempt += 1) {
      await signInWithPassword(client, { provider: 'password', email: EMAIL, password: 'errada-porem-longa' });
    }

    const response = await signInWithPassword(client, {
      provider: 'password',
      email: 'vizinho@example.com',
      password: PASSWORD,
    });

    expect(response.status).toBe(HTTP_STATUS.CREATED);
  });

  test('sem senha ligada, a rota responde 503 em vez de fingir que nao existe', async () => {
    const { client } = createHarness({ isPasswordSignInEnabled: false });

    const response = await register(client);

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(readErrorCode(response)).toBe(ERROR_CODES.auth.PROVIDER_NOT_CONFIGURED);
  });
});

describe('pai bloqueado pelo painel', () => {
  async function signInAndBlock(): Promise<{ harness: Harness; login: TestResponse }> {
    const harness = createHarness();
    const login = await signIn(harness.client);
    const userId = String((readDataRecord(login)['user'] as { id: string }).id);
    harness.accounts.block(userId);
    return { harness, login };
  }

  test('nao entra de novo, e a recusa diz que a conta esta bloqueada', async () => {
    const { harness } = await signInAndBlock();

    const again = await signIn(harness.client);

    expect(again.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(readErrorCode(again)).toBe(ERROR_CODES.auth.USER_BLOCKED);
  });

  test('nao renova a sessao que ja tinha, e todas as sessoes dele caem', async () => {
    const { harness, login } = await signInAndBlock();

    const renewed = await harness.client.send({
      method: HTTP_METHODS.PUT,
      path: SESSIONS_PATH,
      headers: withRefreshCookie(login),
    });

    expect(renewed.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(readErrorCode(renewed)).toBe(ERROR_CODES.auth.USER_BLOCKED);
    expect(harness.sessions.countLiveSessions()).toBe(0);
  });
});
