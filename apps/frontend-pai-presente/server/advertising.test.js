/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildAdsTxt, readAdsEnabled, readAdsenseClientId, readAdvertisingClientId } from './advertising.js';
import { readServerEnvironment } from './environment.js';
import { buildContentSecurityPolicy, CONTENT_SECURITY_POLICY, readPolicyDirective } from './security-headers.js';
import { createWebServer, withAdsenseAccountMeta } from './web.server.js';

const CLIENT_ID = 'ca-pub-1234567890123456';

describe('o id do AdSense e conferido no boot', () => {
  test('vazio desliga, sem erro', () => {
    expect(readAdsenseClientId(undefined)).toBe('');
    expect(readAdsenseClientId('  ')).toBe('');
  });

  test('o formato do painel passa', () => {
    expect(readAdsenseClientId(` ${CLIENT_ID} `)).toBe(CLIENT_ID);
  });

  /** Id errado nao quebra nada visivel: o anuncio aparece e o Google nao paga. */
  test('qualquer outra coisa derruba o boot', () => {
    expect(() => readAdsenseClientId('pub-1234567890123456')).toThrow('ADSENSE_CLIENT_ID');
    expect(() => readAdsenseClientId('ca-pub-abc')).toThrow('ADSENSE_CLIENT_ID');
  });

  test('o ambiente do servidor carrega o id quando ADS_ENABLED esta ligado', () => {
    const environment = readServerEnvironment({
      API_ORIGIN: 'http://api',
      ADS_ENABLED: '1',
      ADSENSE_CLIENT_ID: CLIENT_ID,
    });
    expect(environment.adsenseClientId).toBe(CLIENT_ID);
  });
});

describe('ADS_ENABLED e o interruptor geral, desligado por padrao', () => {
  test('so valor explicito liga', () => {
    for (const value of ['1', 'true', 'TRUE', ' on ', 'yes', 'sim']) expect(readAdsEnabled(value)).toBe(true);
    for (const value of [undefined, '', '0', 'false', 'off', 'talvez']) expect(readAdsEnabled(value)).toBe(false);
  });

  /** E' o que deixa cadastrar os ids e validar antes de ligar. */
  test('com id e sem interruptor, desligado', () => {
    expect(readAdvertisingClientId({ ADSENSE_CLIENT_ID: CLIENT_ID })).toBe('');
    expect(readAdvertisingClientId({ ADSENSE_CLIENT_ID: CLIENT_ID, ADS_ENABLED: '0' })).toBe('');
  });

  test('desligado, o id ainda e conferido', () => {
    expect(() => readAdvertisingClientId({ ADSENSE_CLIENT_ID: 'errado' })).toThrow('ADSENSE_CLIENT_ID');
  });

  test('ligado sem id derruba o boot', () => {
    expect(() => readAdvertisingClientId({ ADS_ENABLED: '1' })).toThrow('ADS_ENABLED');
  });

  test('ligado com id, liga', () => {
    expect(readAdvertisingClientId({ ADS_ENABLED: 'true', ADSENSE_CLIENT_ID: CLIENT_ID })).toBe(CLIENT_ID);
  });
});

describe('o ads.txt declara a conta', () => {
  test('a linha usa pub-, sem o ca-', () => {
    expect(buildAdsTxt(CLIENT_ID)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });
});

describe('a CSP so abre para anuncio quando ele esta ligado', () => {
  test('desligado, a politica e a de sempre', () => {
    expect(buildContentSecurityPolicy({ advertising: false })).toBe(CONTENT_SECURITY_POLICY);
    expect(CONTENT_SECURITY_POLICY).not.toContain('googlesyndication');
  });

  test('ligado, o carregador e o iframe do Google entram', () => {
    const options = { advertising: true };
    expect(readPolicyDirective('script-src', options)).toContain('https://pagead2.googlesyndication.com');
    expect(readPolicyDirective('frame-src', options)).toContain('https://*.doubleclick.net');
    expect(readPolicyDirective('connect-src', options)).toContain('https://*.googlesyndication.com');
  });

  /** Anuncio nao e' desculpa para texto injetado virar codigo. */
  test('ligado, script-src continua sem unsafe-inline e o resto continua fechado', () => {
    const options = { advertising: true };
    expect(readPolicyDirective('script-src', options)).not.toContain("'unsafe-inline'");
    expect(readPolicyDirective('script-src', options)).not.toContain("'unsafe-eval'");
    expect(readPolicyDirective('default-src', options)).toBe("default-src 'self'");
    expect(readPolicyDirective('frame-ancestors', options)).toBe("frame-ancestors 'none'");
    expect(readPolicyDirective('script-src', options)).toContain('https://accounts.google.com');
  });
});

describe('o servidor serve ads.txt e a CSP conforme o id', () => {
  let distDirectory = '';
  let withAds;
  let withoutAds;
  let verifyingOnly;

  beforeAll(() => {
    distDirectory = mkdtempSync(join(tmpdir(), 'pp-ads-'));
    writeFileSync(join(distDirectory, 'index.html'), '<!doctype html><html><head><title>x</title></head></html>');
    const base = { port: 0, distDirectory, apiOrigin: 'http://127.0.0.1:9' };
    withAds = createWebServer({ ...base, adsenseClientId: CLIENT_ID });
    withoutAds = createWebServer(base);
    verifyingOnly = createWebServer({ ...base, adsensePublisherId: CLIENT_ID });
  });

  afterAll(() => {
    withAds?.stop(true);
    withoutAds?.stop(true);
    verifyingOnly?.stop(true);
  });

  test('ligado: /ads.txt em texto, e a tela com a CSP aberta para o Google', async () => {
    const adsTxt = await fetch(new URL('/ads.txt', withAds.url));
    expect(adsTxt.status).toBe(200);
    expect(adsTxt.headers.get('Content-Type')).toContain('text/plain');
    expect(await adsTxt.text()).toContain('pub-1234567890123456');

    const shell = await fetch(new URL('/', withAds.url));
    expect(shell.headers.get('Content-Security-Policy')).toContain('googlesyndication');
  });

  /** E' o que deixa o Google verificar o site antes de ligar anuncio nenhum. */
  test('id cadastrado e ADS_ENABLED desligado: /ads.txt sai, a CSP segue fechada', async () => {
    const adsTxt = await fetch(new URL('/ads.txt', verifyingOnly.url));
    expect(adsTxt.status).toBe(200);
    expect(await adsTxt.text()).toContain('pub-1234567890123456');

    const shell = await fetch(new URL('/', verifyingOnly.url));
    expect(shell.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY);
  });

  /** O robo do AdSense le o HTML do servidor: a metatag nao pode depender do build arg. */
  test('id cadastrado: a tela sai com a metatag do AdSense, mesmo sem ela no build', async () => {
    const shell = await (await fetch(new URL('/', verifyingOnly.url))).text();
    expect(shell).toContain('<meta name="google-adsense-account" content="ca-pub-1234567890123456" />');
    expect(shell.indexOf('google-adsense-account')).toBeLessThan(shell.indexOf('</head>'));

    const route = await (await fetch(new URL('/Perfil', verifyingOnly.url))).text();
    expect(route).toContain('google-adsense-account');
  });

  test('sem id, a tela sai sem metatag; com ela ja no build, nao duplica', async () => {
    expect(await (await fetch(new URL('/', withoutAds.url))).text()).not.toContain('google-adsense-account');

    const built = '<head><meta name="google-adsense-account" content="ca-pub-1" /></head>';
    expect(withAdsenseAccountMeta(built, CLIENT_ID)).toBe(built);
  });

  test('o ambiente separa o id cadastrado do anuncio ligado', () => {
    const environment = readServerEnvironment({ API_ORIGIN: 'http://api', ADSENSE_CLIENT_ID: CLIENT_ID });
    expect(environment.adsenseClientId).toBe('');
    expect(environment.adsensePublisherId).toBe(CLIENT_ID);
  });

  test('sem id: /ads.txt e 404, nao o shell, e a CSP segue fechada', async () => {
    const adsTxt = await fetch(new URL('/ads.txt', withoutAds.url));
    expect(adsTxt.status).toBe(404);

    const shell = await fetch(new URL('/', withoutAds.url));
    expect(shell.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY);
  });
});
