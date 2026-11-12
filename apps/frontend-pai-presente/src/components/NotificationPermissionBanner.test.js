/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(import.meta.dir, 'NotificationPermissionBanner.jsx'), 'utf8');

describe('NotificationPermissionBanner component', () => {
  it('declara acessibilidade semantica (role region e alert)', () => {
    expect(SOURCE).toContain('role="region"');
    expect(SOURCE).toContain('role="alert"');
  });

  it('todos os botoes declaram type="button"', () => {
    const buttons = SOURCE.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toContain('type="button"');
    }
  });

  it('icones decorativos contem aria-hidden="true"', () => {
    const icons = SOURCE.match(/<(Bell|BellRing|BellOff|X|Loader2)\b[^>]*>/g) ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toContain('aria-hidden="true"');
    }
  });

  it('botao so-icone de fechar/dispensar declara aria-label', () => {
    expect(SOURCE).toContain("aria-label={t('notificationBanner.dismiss')}");
  });

  it('consome chaves do i18n sem textos hardcoded em tags JSX', () => {
    expect(SOURCE).toContain("t('notificationBanner.title')");
    expect(SOURCE).toContain("t('notificationBanner.allow')");
    expect(SOURCE).toContain("t('notificationBanner.dismiss')");
    expect(SOURCE).toContain("t('notificationBanner.activeTitle')");
    expect(SOURCE).toContain("t('notificationBanner.disable')");
    expect(SOURCE).toContain("t('notificationBanner.deniedTitle')");
  });
});
