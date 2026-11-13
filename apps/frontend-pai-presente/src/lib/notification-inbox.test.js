/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';

import { buildNotificationBaseUrl, toNotificationLocale } from './notification-inbox';

describe('notification-inbox', () => {
  it('aponta para /v1 da API, com ou sem host', () => {
    expect(buildNotificationBaseUrl('')).toBe('/v1');
    expect(buildNotificationBaseUrl(undefined)).toBe('/v1');
    expect(buildNotificationBaseUrl('https://api.exemplo.com')).toBe('https://api.exemplo.com/v1');
    expect(buildNotificationBaseUrl('https://api.exemplo.com/')).toBe('https://api.exemplo.com/v1');
  });

  it('usa o idioma que o SDK tem', () => {
    expect(toNotificationLocale('pt-BR')).toBe('pt-BR');
    expect(toNotificationLocale('en')).toBe('en');
    expect(toNotificationLocale('en-US')).toBe('en');
    expect(toNotificationLocale('es')).toBe('pt-BR');
    expect(toNotificationLocale(undefined)).toBe('pt-BR');
  });
});
