/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  buildIcsDataUri,
  buildOutlookCalendarUrl,
} from './calendar-link';

describe('calendar-link utilities', () => {
  const sample = {
    title: 'Passeio no zoologico',
    description: 'Levar lanche e bone',
    date: '2026-11-20',
    time: '14:30',
  };

  it('gera URL do Google Calendar para atividade com horario', () => {
    const url = buildGoogleCalendarUrl(sample);
    expect(url).toStartWith('https://calendar.google.com/calendar/render?');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Passeio+no+zoologico');
    expect(url).toContain('dates=20261120T143000%2F20261120T153000');
    expect(url).toContain('details=Levar+lanche+e+bone');
  });

  it('gera URL do Outlook com deeplink valido', () => {
    const url = buildOutlookCalendarUrl(sample);
    expect(url).toStartWith('https://outlook.live.com/calendar/0/deeplink/compose?');
    expect(url).toContain('subject=Passeio+no+zoologico');
    expect(url).toContain('body=Levar+lanche+e+bone');
  });

  it('gera conteudo iCalendar RFC 5545 compativel com Apple Calendar', () => {
    const fixedNow = new Date('2026-11-12T12:00:00.000Z');
    const ics = buildIcsContent(sample, fixedNow);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Passeio no zoologico');
    expect(ics).toContain('DESCRIPTION:Levar lanche e bone');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('gera Data URI para download / abertura nativa no iOS/macOS', () => {
    const dataUri = buildIcsDataUri(sample);
    expect(dataUri).toStartWith('data:text/calendar;charset=utf-8,');
    expect(dataUri).toContain('BEGIN%3AVCALENDAR');
  });

  it('gera URL de dia inteiro quando nao houver horario', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Dia no parque',
      date: '2026-11-21',
    });

    // Fim exclusivo: o Google Agenda nao aceita inicio e fim no mesmo dia.
    expect(url).toContain('dates=20261121%2F20261122');
    expect(url).not.toContain('ctz=');
  });

  it('fixa o fuso de Brasilia na atividade com horario', () => {
    expect(buildGoogleCalendarUrl(sample)).toContain('ctz=America%2FSao_Paulo');
    const outlook = new URL(buildOutlookCalendarUrl(sample));
    expect(outlook.searchParams.get('startdt')).toBe('2026-11-20T17:30:00.000Z');
    expect(outlook.searchParams.get('enddt')).toBe('2026-11-20T18:30:00.000Z');
  });

  it('atividade as 23h termina no dia seguinte, nao antes de comecar', () => {
    const late = { title: 'Ver estrelas', date: '2026-12-31', time: '23:30' };
    expect(buildGoogleCalendarUrl(late)).toContain('dates=20261231T233000%2F20270101T003000');
    const ics = buildIcsContent(late, new Date('2026-11-12T12:00:00.000Z'));
    expect(ics).toContain('DTSTART:20270101T023000Z');
    expect(ics).toContain('DTEND:20270101T033000Z');
  });

  it('dia inteiro vira evento de dia inteiro no .ics e no Outlook', () => {
    const allDay = { title: 'Dia no parque', date: '2026-11-30' };
    const ics = buildIcsContent(allDay, new Date('2026-11-12T12:00:00.000Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130');
    expect(ics).toContain('DTEND;VALUE=DATE:20261201');
    const outlook = new URL(buildOutlookCalendarUrl(allDay));
    expect(outlook.searchParams.get('allday')).toBe('true');
    expect(outlook.searchParams.get('startdt')).toBe('2026-11-30');
    expect(outlook.searchParams.get('enddt')).toBe('2026-12-01');
  });

  it('devolve string vazia quando faltar data ou titulo', () => {
    expect(buildGoogleCalendarUrl({})).toBe('');
    expect(buildGoogleCalendarUrl({ title: 'Sem data' })).toBe('');
    expect(buildGoogleCalendarUrl({ date: '2026-11-20' })).toBe('');
    expect(buildOutlookCalendarUrl({})).toBe('');
    expect(buildIcsContent({})).toBe('');
  });
});
