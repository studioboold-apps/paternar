/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { PWA_MANIFEST, PWA_WORKBOX } from './pwa.config';

const APP_DIRECTORY = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DIRECTORY = join(APP_DIRECTORY, 'public');

function readAppFile(...segments) {
  return readFileSync(join(APP_DIRECTORY, ...segments), 'utf8');
}

const indexHtml = readAppFile('index.html');

describe('manifesto', () => {
  test('declara o que o celular precisa para oferecer instalar', () => {
    expect(PWA_MANIFEST.name).toBe('Paternar — Pai Presente');
    expect(PWA_MANIFEST.short_name).toBe('Paternar');
    expect(PWA_MANIFEST.short_name.length).toBeLessThanOrEqual(12);
    expect(PWA_MANIFEST.start_url).toBe('/');
    expect(PWA_MANIFEST.display).toBe('standalone');
    expect(PWA_MANIFEST.lang).toBe('pt-BR');
    expect(PWA_MANIFEST.theme_color).toMatch(/^#[0-9a-f]{6}$/);
    expect(PWA_MANIFEST.background_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  /** Sem 192 e 512 o Chrome nao mostra o convite de instalacao. */
  test.each(['192x192', '512x512'])('tem icone PNG %s', (sizes) => {
    expect(PWA_MANIFEST.icons.some((icon) => icon.sizes === sizes && icon.type === 'image/png')).toBe(true);
  });

  test('tem icone maskable, para o Android nao recortar a marca', () => {
    expect(PWA_MANIFEST.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  /**
   * Manifesto apontando para arquivo inexistente instala um app sem icone, e o
   * navegador nao acusa nada: e' exatamente o defeito herdado da Base44, que
   * declarava `/manifest.json` sem o arquivo existir.
   */
  test.each(PWA_MANIFEST.icons.map((icon) => icon.src))('o arquivo %s existe', (src) => {
    expect(existsSync(join(PUBLIC_DIRECTORY, src))).toBe(true);
  });
});

describe('service worker', () => {
  test('a API vai por rede primeiro, e o resto do que fica em cache e estatico', () => {
    const apiRule = PWA_WORKBOX.runtimeCaching.find((rule) => rule.urlPattern.test('/v1/children'));

    expect(apiRule.handler).toBe('NetworkFirst');
    expect(apiRule.options.networkTimeoutSeconds).toBeGreaterThan(0);
  });

  /**
   * Rota de SPA offline tem de cair no shell; se a lista de excecao nao tiver
   * `/v1`, uma chamada de API offline volta o HTML do app e o cliente quebra
   * tentando ler JSON.
   */
  test('a chamada de API nunca cai no shell', () => {
    expect(PWA_WORKBOX.navigateFallback).toBe('/index.html');
    expect(PWA_WORKBOX.navigateFallbackDenylist.some((pattern) => pattern.test('/v1/children'))).toBe(true);
  });

  /** Com o app instalado, a politica de privacidade nao pode cair no login. */
  test('as paginas publicas e os arquivos dos robos nunca caem no shell', () => {
    const denied = (path) => PWA_WORKBOX.navigateFallbackDenylist.some((pattern) => pattern.test(path));

    for (const path of ['/sobre', '/privacidade', '/ads.txt', '/robots.txt', '/sitemap.xml']) {
      expect(denied(path)).toBe(true);
    }
    expect(denied('/Perfil')).toBe(false);
  });

  test('o asset estatico fica em cache antes da rede', () => {
    const assetRule = PWA_WORKBOX.runtimeCaching.find((rule) => rule.urlPattern.test('/icons/icon-192.png'));

    expect(assetRule.handler).toBe('CacheFirst');
  });

  test('a pagina de queda entra no precache e traz a marca', () => {
    const offlineHtml = readAppFile('public', 'offline.html');
    const isPrecached = PWA_WORKBOX.globPatterns.some((pattern) => new Bun.Glob(pattern).match('offline.html'));

    expect(isPrecached).toBe(true);
    expect(offlineHtml).toContain('Paternar');
    expect(offlineHtml).toContain('Pai Presente');
    expect(existsSync(join(PUBLIC_DIRECTORY, 'marca-pai-presente.png'))).toBe(true);
    expect(offlineHtml).toContain('marca-pai-presente.png');
  });
});

describe('index.html', () => {
  test('fala portugues e diz o nome do produto', () => {
    expect(indexHtml).toContain('lang="pt-BR"');
    expect(indexHtml).toContain('<title>Paternar — Pai Presente</title>');
  });

  /**
   * O `index.html` saiu de la com o titulo `Base44 APP` e o icone servido pelo
   * site deles: enquanto sobrar uma linha assim, o app de outra empresa e' quem
   * decide o que aparece na aba do pai.
   */
  test('nao carrega nada da Base44', () => {
    expect(indexHtml.toLowerCase()).not.toContain('base44');
  });

  test('o link do manifesto vem do plugin, nao escrito a mao', () => {
    expect(indexHtml).not.toContain('manifest.json');
  });

  test('o icone do iOS existe, porque la o manifesto nao basta', () => {
    const [, href] = indexHtml.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/) ?? [];

    expect(existsSync(join(PUBLIC_DIRECTORY, href ?? ''))).toBe(true);
  });

  test('a cor da barra do sistema e a mesma do manifesto', () => {
    expect(indexHtml).toContain(`<meta name="theme-color" content="${PWA_MANIFEST.theme_color}" />`);
  });
});
