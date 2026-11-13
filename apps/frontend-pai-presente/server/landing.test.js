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
import { buildAppRedirectUrl, normalizeHost, readLandingHosts, RETIRING_SERVICE_WORKER } from './landing.js';
import { createWebServer } from './web.server.js';

const SHELL_MARK = '<!doctype html><html><head><title>app</title></head><body></body></html>';
const LANDING_MARK = '<!doctype html><html><head><title>vitrine</title></head><body></body></html>';
const PRIVACY_MARK = '<!doctype html><title>privacidade</title>';
const PUBLISHER_ID = 'ca-pub-1234567890123456';

const LANDING_HOST = 'paternar.com.br';
const APP_HOST = 'app.paternar.com.br';
const APP_URL = `https://${APP_HOST}`;

let api;
let web;
let origin = '';

/**
 * O teste fala com o IP de loopback, mas diz ao servidor qual dominio pediu.
 * IP e nao `localhost`, para nao depender de como o CI resolve o nome.
 * `Connection: close` e o corpo sempre lido evitam reaproveitar conexao presa.
 */
async function get(path, host, init = {}) {
  const response = await fetch(`${origin}${path}`, {
    redirect: 'manual',
    ...init,
    headers: { 'x-forwarded-host': host, connection: 'close', ...(init.headers ?? {}) },
  });
  const body = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

beforeAll(() => {
  const distDirectory = mkdtempSync(join(tmpdir(), 'pp-landing-'));
  writeFileSync(join(distDirectory, 'index.html'), SHELL_MARK);
  writeFileSync(join(distDirectory, 'landing.html'), LANDING_MARK);
  writeFileSync(join(distDirectory, 'privacidade.html'), PRIVACY_MARK);
  writeFileSync(join(distDirectory, 'sw.js'), '// service worker do app');
  mkdirSync(join(distDirectory, 'landing'));
  writeFileSync(join(distDirectory, 'landing', 'foto.webp'), 'imagem');

  api = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    /**
     * Le o corpo antes de responder, como a API de verdade faz. Corpo de POST
     * deixado sem ler prende a conexao reaproveitada, e o proximo repasse
     * (`GET /v1/me`) ficava pendurado ate o limite do teste no Bun 1.3.
     */
    fetch: async (request) => {
      await request.text();
      return Response.json({ path: new URL(request.url).pathname, method: request.method });
    },
  });

  web = createWebServer({
    port: 0,
    distDirectory,
    apiOrigin: `http://127.0.0.1:${api.port}`,
    adsensePublisherId: PUBLISHER_ID,
    landingHosts: readLandingHosts(`${LANDING_HOST}, www.${LANDING_HOST}`),
    appUrl: APP_URL,
  });
  origin = `http://127.0.0.1:${web.port}`;
});

afterAll(() => {
  web?.stop(true);
  api?.stop(true);
});

describe('dominio principal: a vitrine', () => {
  test('a raiz e a vitrine, com a metatag do AdSense', async () => {
    const response = await get('/', LANDING_HOST);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>vitrine</title>');
    expect(html).toContain(PUBLISHER_ID);
  });

  test('o www tambem e vitrine, com ou sem porta e maiusculas', async () => {
    const response = await get('/', `WWW.${LANDING_HOST}:443`);

    expect(await response.text()).toContain('<title>vitrine</title>');
  });

  test('a vitrine sai com os cabecalhos de seguranca', async () => {
    const response = await get('/', LANDING_HOST);

    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  test('rota do app vai para o subdominio, com o mesmo caminho e a mesma busca', async () => {
    const response = await get('/juntinhos?dia=3', LANDING_HOST);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${APP_URL}/juntinhos?dia=3`);
  });

  test('o index.html do app tambem vai para o subdominio', async () => {
    const response = await get('/index.html', LANDING_HOST);

    expect(response.headers.get('location')).toBe(`${APP_URL}/`);
  });

  test('pagina publica e arquivo continuam no dominio principal', async () => {
    expect(await (await get('/privacidade', LANDING_HOST)).text()).toBe(PRIVACY_MARK);
    expect(await (await get('/landing/foto.webp', LANDING_HOST)).text()).toBe('imagem');
  });

  test('o service worker antigo recebe o que o aposenta', async () => {
    const response = await get('/sw.js', LANDING_HOST);

    expect(await response.text()).toBe(RETIRING_SERVICE_WORKER);
    expect(response.headers.get('content-type')).toContain('javascript');
  });
});

describe('dominio principal: o que nao pode quebrar', () => {
  test('o webhook da Hotmart continua chegando na API', async () => {
    const response = await get('/v1/payments/webhooks/hotmart', LANDING_HOST, { method: 'POST', body: '{}' });

    expect(await response.json()).toEqual({ path: '/v1/payments/webhooks/hotmart', method: 'POST' });
  });

  test('o ads.txt continua na raiz', async () => {
    const response = await get('/ads.txt', LANDING_HOST);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('pub-1234567890123456');
  });

  test('o /health continua respondendo', async () => {
    expect((await get('/health', LANDING_HOST)).status).toBe(200);
  });
});

describe('subdominio do app: tudo como antes', () => {
  test('a raiz e o app', async () => {
    expect(await (await get('/', APP_HOST)).text()).toContain('<title>app</title>');
  });

  test('rota da SPA cai no shell, sem desvio', async () => {
    const response = await get('/juntinhos', APP_HOST);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>app</title>');
  });

  test('o service worker e o do app', async () => {
    expect(await (await get('/sw.js', APP_HOST)).text()).toBe('// service worker do app');
  });

  test('a API tambem responde no subdominio', async () => {
    expect(await (await get('/v1/me', APP_HOST)).json()).toMatchObject({ path: '/v1/me' });
  });
});

describe('configuracao', () => {
  test('host normalizado: sem porta, sem maiuscula, sem ponto final', () => {
    expect(normalizeHost('Paternar.COM.br:8080')).toBe('paternar.com.br');
    expect(normalizeHost('paternar.com.br.')).toBe('paternar.com.br');
  });

  test('lista vazia desliga a vitrine', () => {
    expect(readLandingHosts('').size).toBe(0);
    expect(readLandingHosts(undefined).size).toBe(0);
  });

  test('o desvio usa so a origem do APP_URL', () => {
    expect(buildAppRedirectUrl('https://app.paternar.com.br/qualquer', '/perfil', '?a=1')).toBe(
      'https://app.paternar.com.br/perfil?a=1',
    );
  });

  test('vitrine ligada sem APP_URL nao sobe', () => {
    expect(() => readServerEnvironment({ API_ORIGIN: 'http://api', LANDING_HOSTS: LANDING_HOST })).toThrow('APP_URL');
  });

  test('vitrine ligada com APP_URL sobe', () => {
    const environment = readServerEnvironment({
      API_ORIGIN: 'http://api',
      LANDING_HOSTS: `${LANDING_HOST},www.${LANDING_HOST}`,
      APP_URL,
    });

    expect([...environment.landingHosts]).toEqual([LANDING_HOST, `www.${LANDING_HOST}`]);
    expect(environment.appUrl).toBe(APP_URL);
  });
});
