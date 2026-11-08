/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { adsenseAccountPlugin, buildAdsenseAccountMeta } from './adsense-account.plugin.js';

const HTML = '<html><head><title>x</title></head><body></body></html>';

describe('a metatag do AdSense verifica o site sem ligar anuncio', () => {
  test('com o id, a metatag entra no head', () => {
    const html = adsenseAccountPlugin({ clientId: 'ca-pub-1234567890123456' }).transformIndexHtml(HTML);

    expect(html).toContain('<meta name="google-adsense-account" content="ca-pub-1234567890123456" />');
    expect(html.indexOf('google-adsense-account')).toBeLessThan(html.indexOf('</head>'));
  });

  test('sem id ou com id fora do formato, o html sai igual', () => {
    expect(adsenseAccountPlugin({ clientId: '' }).transformIndexHtml(HTML)).toBe(HTML);
    expect(buildAdsenseAccountMeta('ca-pub-"><script>')).toBe('');
  });
});
