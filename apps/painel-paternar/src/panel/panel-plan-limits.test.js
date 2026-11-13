/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { formToSettings, previewBudgetMicroUsd, settingsToForm } from './panel-plan-limits';

const SETTINGS = {
  enabled: false,
  freeChatMessagesPerWeek: 10,
  freeMaxChildren: 1,
  subscriberRevenueCentsBrl: 1990,
  aiShareOfRevenuePct: 30,
  usdBrlRateCents: 550,
  individualCapMicroUsd: 5_000_000,
  warnAtPct: 80,
};

describe('limites do plano no painel', () => {
  test('ida e volta: reais e dolares com virgula', () => {
    const form = settingsToForm(SETTINGS);
    expect(form.subscriberRevenueBrl).toBe('19,90');
    expect(form.usdBrlRate).toBe('5,50');
    expect(form.individualCapUsd).toBe('5,00');
    expect(formToSettings(form)).toEqual(SETTINGS);
  });

  test('aceita ponto como milhar e virgula como decimal', () => {
    const form = { ...settingsToForm(SETTINGS), subscriberRevenueBrl: '1.234,56' };
    expect(formToSettings(form)?.subscriberRevenueCentsBrl).toBe(123_456);
  });

  test('campo que nao e numero trava o salvar', () => {
    expect(formToSettings({ ...settingsToForm(SETTINGS), warnAtPct: 'oitenta' })).toBeNull();
  });

  test('orcamento previsto de 100 assinantes', () => {
    expect(previewBudgetMicroUsd(SETTINGS, 100)).toBe(108_545_455);
  });
});
