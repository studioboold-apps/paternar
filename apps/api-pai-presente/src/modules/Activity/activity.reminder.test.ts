/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';

import type { SendNotificationParams } from '@adatechnology/notification-contracts';
import type { NotificationModule } from '@adatechnology/notification-module';

import { createActivityUseCases, formatBrazilianDate } from './activity.use-case';
import type { ActivityRepository } from './types/activity.types';

const USER_ID = '22222222-2222-4222-8222-222222222222';

function setup() {
  const sent: SendNotificationParams[] = [];
  const notifications = {
    useCases: {
      sendNotification: {
        async execute(params: SendNotificationParams) {
          sent.push(params);
          return { notificationId: 'n', deduplicated: false, deliveries: [] };
        },
      },
    },
  } as unknown as NotificationModule;
  const repository = {
    insert: async (row: Record<string, unknown>) => ({ id: 'a1', ...row }),
  } as unknown as ActivityRepository;
  const useCases = createActivityUseCases({
    repository,
    childOwnership: { assertOwned: async () => undefined } as never,
    notifications,
  });
  return { useCases, sent };
}

describe('lembrete de atividade', () => {
  beforeEach(() => setSystemTime(new Date('2026-03-01T12:00:00Z')));
  afterEach(() => setSystemTime());

  it('le a hora digitada como horario de Brasilia: 10:00 lembra as 09:00 de Brasilia (12:00 UTC)', async () => {
    const { useCases, sent } = setup();
    await useCases.create({
      userId: USER_ID,
      values: { title: 'Parque', activityDate: '2026-03-10', activityTime: '10:00' } as never,
    });

    const reminder = sent.find((params) => params.templateKey === 'atividades.lembrete');
    expect(new Date(reminder?.scheduledFor as Date).toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });

  it('sem hora, lembra as 08:00 de Brasilia do dia', async () => {
    const { useCases, sent } = setup();
    await useCases.create({ userId: USER_ID, values: { title: 'Parque', activityDate: '2026-03-10' } as never });

    const reminder = sent.find((params) => params.templateKey === 'atividades.lembrete');
    expect(new Date(reminder?.scheduledFor as Date).toISOString()).toBe('2026-03-10T11:00:00.000Z');
  });
});

describe('formatBrazilianDate', () => {
  it('mostra a data da atividade como o pai le', () => {
    expect(formatBrazilianDate('2026-11-15')).toBe('15/11/2026');
    expect(formatBrazilianDate('15/11/2026')).toBe('15/11/2026');
  });
});
