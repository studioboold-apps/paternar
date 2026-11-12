/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';
import { buildGoogleCalendarUrl } from './calendar-link';

describe('buildGoogleCalendarUrl', () => {
  it('gera URL do Google Calendar para atividade com horario', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Passeio no zoologico',
      description: 'Levar lanche e bone',
      date: '2026-11-20',
      time: '14:30',
    });

    expect(url).toStartWith('https://calendar.google.com/calendar/render?');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Passeio+no+zoologico');
    expect(url).toContain('dates=20261120T143000%2F20261120T153000');
    expect(url).toContain('details=Levar+lanche+e+bone');
  });

  it('gera URL de dia inteiro quando nao houver horario', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Dia no parque',
      date: '2026-11-21',
    });

    expect(url).toContain('dates=20261121%2F20261121');
  });

  it('devolve string vazia quando faltar data ou titulo', () => {
    expect(buildGoogleCalendarUrl({})).toBe('');
    expect(buildGoogleCalendarUrl({ title: 'Sem data' })).toBe('');
    expect(buildGoogleCalendarUrl({ date: '2026-11-20' })).toBe('');
  });
});
