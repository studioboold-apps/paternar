/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A API guarda dinheiro em inteiros (centavos, micro-dolar); a tela mostra em
 * reais e dolares com virgula. A conversao mora aqui, testada, e nao no JSX.
 */

const MICRO = 1_000_000;

const toNumber = (value) => Number(String(value ?? '').trim().replace(/\./g, '').replace(',', '.'));
const decimal = (value, digits = 2) =>
  Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });

/** Da API para o formulario. */
export function settingsToForm(settings) {
  return {
    enabled: Boolean(settings.enabled),
    freeChatMessagesPerWeek: String(settings.freeChatMessagesPerWeek),
    freeMaxChildren: String(settings.freeMaxChildren),
    subscriberRevenueBrl: decimal(settings.subscriberRevenueCentsBrl / 100),
    aiShareOfRevenuePct: String(settings.aiShareOfRevenuePct),
    usdBrlRate: decimal(settings.usdBrlRateCents / 100),
    individualCapUsd: decimal(settings.individualCapMicroUsd / MICRO),
    warnAtPct: String(settings.warnAtPct),
  };
}

/** Do formulario para a API. Campo que nao e' numero volta `null` e trava o salvar. */
export function formToSettings(form) {
  const values = {
    enabled: Boolean(form.enabled),
    freeChatMessagesPerWeek: Math.round(toNumber(form.freeChatMessagesPerWeek)),
    freeMaxChildren: Math.round(toNumber(form.freeMaxChildren)),
    subscriberRevenueCentsBrl: Math.round(toNumber(form.subscriberRevenueBrl) * 100),
    aiShareOfRevenuePct: Math.round(toNumber(form.aiShareOfRevenuePct)),
    usdBrlRateCents: Math.round(toNumber(form.usdBrlRate) * 100),
    individualCapMicroUsd: Math.round(toNumber(form.individualCapUsd) * MICRO),
    warnAtPct: Math.round(toNumber(form.warnAtPct)),
  };
  return Object.values(values).some((value) => typeof value === 'number' && !Number.isFinite(value)) ? null : values;
}

/** Orcamento previsto: assinantes x receita x % para IA, convertido para dolar. */
export function previewBudgetMicroUsd(settings, subscribers) {
  if (!settings || settings.usdBrlRateCents <= 0) return 0;
  const revenueUsd = (subscribers * settings.subscriberRevenueCentsBrl) / settings.usdBrlRateCents;
  return Math.round(revenueUsd * (settings.aiShareOfRevenuePct / 100) * MICRO);
}
