/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Numeros, datas e dinheiro como a equipe le: pt-BR, fuso de Sao Paulo.
 */

const TIME_ZONE = 'America/Sao_Paulo';

export const formatNumber = (value) => Number(value ?? 0).toLocaleString('pt-BR');

export function formatPercent(part, whole) {
  if (!whole) return '—';
  return `${Math.round((Number(part) / Number(whole)) * 100)}%`;
}

/** Custo vem em milionesimos de dolar; centavo some quando o valor e' pequeno. */
export function formatUsd(microUsd) {
  const usd = Number(microUsd ?? 0) / 1_000_000;
  const digits = usd !== 0 && Math.abs(usd) < 1 ? 4 : 2;
  return `US$ ${usd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
}

/** Dinheiro do pagamento: centavos e moeda ISO (BRL, USD). */
export function formatMoney(cents, currency = 'BRL') {
  const value = Number(cents ?? 0) / 100;
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency });
  } catch {
    return `${currency} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

/** "ha 3 dias", "agora ha pouco" — para "ultimo acesso". */
export function formatRelative(value, now = Date.now()) {
  if (!value) return 'nunca';
  const minutes = Math.round((now - new Date(value).getTime()) / 60_000);
  if (minutes < 2) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return `em ${formatDate(value)}`;
}

/** Chave de dia (AAAA-MM-DD) no fuso de Sao Paulo, para agrupar a linha do tempo. */
export function dayKey(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(value));
}

export function formatDayHeading(key, now = new Date()) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (key === today) return 'Hoje';
  if (key === yesterday) return 'Ontem';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}

export const shortDay = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
