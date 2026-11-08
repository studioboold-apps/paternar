/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readServerEnvironment } from './environment.js';
import { chooseCacheControl, createWebServer, isApiPath, resolveStaticPath } from './web.server.js';

const SHELL_MARK = '<!doctype html><title>pai presente</title>';
const ASSET_MARK = 'console.log("asset")';
const PUBLIC_PAGE_MARK = '<!doctype html><title>politica de privacidade</title>';

let distDirectory = '';
let api;
let web;
let origin = '';

beforeAll(() => {
  distDirectory = mkdtempSync(join(tmpdir(), 'pp-dist-'));
  mkdirSync(join(distDirectory, 'assets'));
  writeFileSync(join(distDirectory, 'index.html'), SHELL_MARK);
  writeFileSync(join(distDirectory, 'assets', 'app-abc123.js'), ASSET_MARK);
  writeFileSync(join(distDirectory, 'privacidade.html'), PUBLIC_PAGE_MARK);
  writeFileSync(join(distDirectory, '..', 'fora-do-dist.txt'), 'segredo');

  api = Bun.serve({
    port: 0,
    fetch: (request) =>
      Response.json({ path: new URL(request.url).pathname, cookie: request.headers.get('cookie') }),
  });

  web = createWebServer({ port: 0, distDirectory, apiOrigin: api.url.origin });
  origin = web.url.origin;
});

afterAll(() => {
  web?.stop(true);
  api?.stop(true);
});

/**
 * A rede privada do provedor e' IPv6, e a checagem de saude chega por ela. O
 * padrao do `Bun.serve` e' `0.0.0.0`, que so escuta IPv4: o container sobe, diz
 * que esta no ar, e recusa toda checagem — medido na API em 05/09/2026, dez
 * tentativas seguidas ate o deploy ser descartado com o processo vivo.
 */
describe('a tela escuta onde a rede privada chama', () => {
  test('o servidor atende em todas as interfaces, IPv6 inclusive', () => {
    expect(web.hostname).toBe('::');
  });
});

describe('a tela e a API saem da MESMA origem', () => {
  /**
   * O cookie de sessao e' `SameSite=Lax` e host-only: tela num host e API em
   * outro faz o pai entrar e continuar deslogado, sem erro visivel.
   */
  test('o que comeca com /v1 vai para a API', async () => {
    const response = await fetch(`${origin}/v1/me`);

    expect(await response.json()).toMatchObject({ path: '/v1/me' });
  });

  test('o cookie do navegador atravessa o repasse', async () => {
    const response = await fetch(`${origin}/v1/me`, { headers: { cookie: 'pp_access=abc' } });

    expect((await response.json()).cookie).toBe('pp_access=abc');
  });

  /** `/v1abc` nao e' rota da API — casar por prefixo cru mandaria embora. */
  test('caminho que so PARECE da API fica na tela', () => {
    expect(isApiPath('/v1')).toBe(true);
    expect(isApiPath('/v1/me')).toBe(true);
    expect(isApiPath('/v1abc')).toBe(false);
  });
});

describe('a pagina unica sobrevive a recarregar fora da raiz', () => {
  test('rota do navegador devolve o index, nao 404', async () => {
    const response = await fetch(`${origin}/perfil`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(SHELL_MARK);
  });

  test('arquivo que existe e servido de verdade', async () => {
    const response = await fetch(`${origin}/assets/app-abc123.js`);

    expect(await response.text()).toBe(ASSET_MARK);
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  test('o index nunca fica preso em cache', async () => {
    const response = await fetch(`${origin}/`);

    expect(response.headers.get('cache-control')).toBe('no-cache');
  });
});

/**
 * O pai deslogado e o robo do AdSense leem `/privacidade` sem passar pelo login
 * da SPA: o endereco limpo serve o `.html` do mesmo nome.
 */
describe('as paginas publicas saem em HTML puro pelo endereco limpo', () => {
  test('/privacidade serve privacidade.html', async () => {
    const response = await fetch(`${origin}/privacidade`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(PUBLIC_PAGE_MARK);
  });

  test('pagina sem arquivo continua no shell da SPA', async () => {
    expect(await (await fetch(`${origin}/inexistente`)).text()).toBe(SHELL_MARK);
  });
});

describe('o disco fora do dist nao e servido', () => {
  /**
   * Medido: `normalize` ja come o `..` de um caminho absoluto, entao o pedido
   * cai DENTRO do dist em vez de virar `undefined`. A propriedade que importa
   * nao e' o retorno vazio — e' que nenhuma entrada resolva para fora do teto.
   */
  test('subir de pasta nunca resolve para fora do teto', () => {
    const escapes = ['/../fora-do-dist.txt', '/%2e%2e/fora-do-dist.txt', '/assets/../../x'];

    for (const pathname of escapes) {
      const resolved = resolveStaticPath({ distDirectory, pathname });
      expect(resolved === undefined || resolved.startsWith(distDirectory)).toBe(true);
    }
  });

  test('o pedido com .. cai no index em vez de vazar arquivo', async () => {
    const response = await fetch(`${origin}/../fora-do-dist.txt`, { redirect: 'manual' });
    const body = await response.text();

    expect(body).not.toContain('segredo');
  });

  test('caminho dentro do dist continua resolvendo', () => {
    expect(resolveStaticPath({ distDirectory, pathname: '/assets/app-abc123.js' })).toBe(
      join(distDirectory, 'assets', 'app-abc123.js'),
    );
  });
});

describe('o ambiente e conferido no boot', () => {
  /** Sem `API_ORIGIN` a imagem subiria verde e so falharia no login. */
  test('sem API_ORIGIN o processo nao sobe', () => {
    expect(() => readServerEnvironment({})).toThrow('API_ORIGIN');
  });

  test('porta invalida nao vira NaN silencioso', () => {
    expect(() => readServerEnvironment({ API_ORIGIN: 'http://api', WEB_PORT: 'oito' })).toThrow(
      'WEB_PORT',
    );
  });

  test('os padroes servem o contêiner sem env extra', () => {
    expect(readServerEnvironment({ API_ORIGIN: 'http://api' })).toEqual({
      apiOrigin: 'http://api',
      port: 8080,
      distDirectory: 'dist',
      adsenseClientId: '',
      adsensePublisherId: '',
    });
  });
});

describe('cache', () => {
  test('so o que tem hash no nome e imutavel', () => {
    expect(chooseCacheControl('/assets/app-abc123.js')).toContain('immutable');
    expect(chooseCacheControl('/sw.js')).toBe('no-cache');
  });
});

/**
 * `S-005`: a imagem servia `dist` sem cabecalho de seguranca nenhum. Aqui a
 * afirmacao e' sobre a RESPOSTA de verdade, com servidor de pe — o teste de
 * `security-headers.test.js` prova o conteudo da politica, este prova que ela
 * chega ao navegador.
 */
describe('a resposta da tela sai blindada', () => {
  test('o index carrega CSP, HSTS e os quatro basicos', async () => {
    const response = await fetch(`${origin}/perfil`);

    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  /** Arquivo com hash tambem: o `nosniff` importa justamente no asset. */
  test('o asset sai blindado e ainda imutavel', async () => {
    const response = await fetch(`${origin}/assets/app-abc123.js`);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
  });

  test('a saude tambem, porque e a resposta que o provedor le', async () => {
    expect((await fetch(`${origin}/health`)).headers.get('X-Frame-Options')).toBe('DENY');
  });

  /**
   * O repasse NAO e' recarimbado: a API ja manda os cabecalhos dela, e uma CSP
   * de documento colada em JSON so atrapalha quem for depurar. Se um dia a API
   * parar de mandar, o defeito e' la — e o teste da API e' que pega.
   */
  test('o que veio da API atravessa como a API mandou', async () => {
    const response = await fetch(`${origin}/v1/me`);

    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });
});

describe('o servidor nao serve a tela em texto puro atras do proxy', () => {
  test('proxy dizendo http devolve desvio para https', async () => {
    const response = await fetch(`${origin}/perfil`, {
      headers: { 'x-forwarded-proto': 'http', 'x-forwarded-host': 'paipresente.app' },
      redirect: 'manual',
    });

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://paipresente.app/perfil');
  });

  /** O desvio vem ANTES do repasse: chamada de API em texto puro tambem sobe. */
  test('ate o repasse da API e desviado', async () => {
    const response = await fetch(`${origin}/v1/me`, {
      headers: { 'x-forwarded-proto': 'http', 'x-forwarded-host': 'paipresente.app' },
      redirect: 'manual',
    });

    expect(response.status).toBe(308);
  });

  test('sem proxy na frente a imagem serve normalmente', async () => {
    expect((await fetch(`${origin}/perfil`)).status).toBe(200);
  });
});
