/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Gera link universal para abrir o Google Agenda com o evento preenchido.
 */

export function buildGoogleCalendarUrl({ title, description, date, time }) {
  if (!date || !title) return '';

  const cleanDate = date.replace(/-/g, '');
  let dates;

  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [hh, mm] = time.split(':');
    const startStr = `${cleanDate}T${hh}${mm}00`;
    const nextHh = String((Number(hh) + 1) % 24).padStart(2, '0');
    const endStr = `${cleanDate}T${nextHh}${mm}00`;
    dates = `${startStr}/${endStr}`;
  } else {
    dates = `${cleanDate}/${cleanDate}`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
  });

  if (description) {
    params.set('details', description);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
