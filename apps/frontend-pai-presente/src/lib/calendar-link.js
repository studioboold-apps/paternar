/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Gera links e arquivos de calendario universais (Google Agenda, Apple Calendar .ics, Outlook).
 */

function formatUtcCompact(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeIcsText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n');
}

/**
 * Data e hora que o pai digita sao de Brasilia — a API agenda o lembrete no
 * mesmo fuso (`activity.use-case.ts`). Sem fixar o fuso aqui, um celular em
 * outro fuso (ou com o relogio em UTC) gravava a atividade horas fora do lugar
 * no .ics e no Outlook.
 */
const APP_TIMEZONE = 'America/Sao_Paulo';
const APP_TIMEZONE_OFFSET = '-03:00';
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const pad = (value) => String(value).padStart(2, '0');

/** `YYYYMMDD` do dia seguinte, sem passar pelo fuso do aparelho. */
function nextDay(date) {
  const following = new Date(Date.parse(`${date}T00:00:00Z`) + ONE_DAY_MS);
  return `${following.getUTCFullYear()}-${pad(following.getUTCMonth() + 1)}-${pad(following.getUTCDate())}`;
}

/** Relogio de parede (sem fuso) `YYYYMMDDTHHMMSS` de um instante em UTC deslocado. */
function wallClockCompact(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

function resolveDates({ date, time }) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  if (time && /^\d{2}:\d{2}$/.test(time)) {
    // O fim e somado no relogio, nao na string da hora: "23:30" terminava as
    // "00:30" do MESMO dia, antes de comecar, e a agenda recusava o evento.
    const wallStart = new Date(`${date}T${time}:00Z`);
    const wallEnd = new Date(wallStart.getTime() + ONE_HOUR_MS);
    const start = new Date(`${date}T${time}:00${APP_TIMEZONE_OFFSET}`);
    return {
      isAllDay: false,
      datesParam: `${wallClockCompact(wallStart)}/${wallClockCompact(wallEnd)}`,
      start,
      end: new Date(start.getTime() + ONE_HOUR_MS),
    };
  }

  // Dia inteiro: o fim e exclusivo (dia seguinte). Com inicio e fim no mesmo
  // dia, o Google Agenda abria o formulario sem a data.
  const endDate = nextDay(date);
  return {
    isAllDay: true,
    datesParam: `${date.replace(/-/g, '')}/${endDate.replace(/-/g, '')}`,
    startDate: date,
    endDate,
  };
}

/**
 * Gera URL para abrir o Google Agenda com o evento preenchido.
 */
export function buildGoogleCalendarUrl({ title, description, date, time }) {
  if (!date || !title) return '';
  const resolved = resolveDates({ date, time });
  if (!resolved) return '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: resolved.datesParam,
  });

  if (!resolved.isAllDay) params.set('ctz', APP_TIMEZONE);
  if (description) {
    params.set('details', description);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Gera URL para abrir o Outlook Web / Live.
 */
export function buildOutlookCalendarUrl({ title, description, date, time }) {
  if (!date || !title) return '';
  const resolved = resolveDates({ date, time });
  if (!resolved) return '';

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
  });

  if (resolved.isAllDay) {
    params.set('startdt', resolved.startDate);
    params.set('enddt', resolved.endDate);
    params.set('allday', 'true');
  } else {
    params.set('startdt', resolved.start.toISOString());
    params.set('enddt', resolved.end.toISOString());
  }

  if (description) {
    params.set('body', description);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Gera conteúdo RFC 5545 iCalendar (.ics) para Apple Calendar / Android / Desktop.
 */
export function buildIcsContent({ title, description, date, time }, now = new Date()) {
  if (!date || !title) return '';
  const resolved = resolveDates({ date, time });
  if (!resolved) return '';

  const uid = `${now.getTime()}-${Math.random().toString(36).substring(2, 9)}@paternar.com.br`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Paternar//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcCompact(now)}`,
    ...(resolved.isAllDay
      ? [
          `DTSTART;VALUE=DATE:${resolved.startDate.replace(/-/g, '')}`,
          `DTEND;VALUE=DATE:${resolved.endDate.replace(/-/g, '')}`,
        ]
      : [`DTSTART:${formatUtcCompact(resolved.start)}`, `DTEND:${formatUtcCompact(resolved.end)}`]),
    `SUMMARY:${escapeIcsText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Gera Data URI do .ics para abertura nativa no iOS / macOS ou download imediato.
 */
export function buildIcsDataUri(activity) {
  const ics = buildIcsContent(activity);
  if (!ics) return '';
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/**
 * Dispara o download de um arquivo .ics no navegador.
 */
export function downloadIcsFile(activity) {
  const dataUri = buildIcsDataUri(activity);
  if (!dataUri || typeof document === 'undefined') return;

  const link = document.createElement('a');
  link.href = dataUri;
  const safeTitle = (activity.title || 'atividade')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  link.download = `${safeTitle}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
