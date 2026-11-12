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

function resolveDates({ date, time }) {
  if (!date) return null;
  const cleanDate = date.replace(/-/g, '');

  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [hh, mm] = time.split(':');
    const startStr = `${cleanDate}T${hh}${mm}00`;
    const nextHh = String((Number(hh) + 1) % 24).padStart(2, '0');
    const endStr = `${cleanDate}T${nextHh}${mm}00`;
    return {
      isAllDay: false,
      datesParam: `${startStr}/${endStr}`,
      startIso: `${date}T${time}:00`,
      endIso: `${date}T${nextHh}:${mm}:00`,
    };
  }

  return {
    isAllDay: true,
    datesParam: `${cleanDate}/${cleanDate}`,
    startIso: `${date}T09:00:00`,
    endIso: `${date}T10:00:00`,
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

  const start = new Date(resolved.startIso);
  const end = new Date(resolved.endIso);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });

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

  const start = new Date(resolved.startIso);
  const end = new Date(resolved.endIso);
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
    `DTSTART:${formatUtcCompact(start)}`,
    `DTEND:${formatUtcCompact(end)}`,
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
