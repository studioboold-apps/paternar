/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';

import type { SendNotificationParams } from '@adatechnology/notification-contracts';
import type { NotificationModule } from '@adatechnology/notification-module';

import {
  AppAccountNotFoundError,
  categoryForTemplateKey,
  createSendTemplateTest,
  InvalidTemplateKeyError,
  TEMPLATE_TEST_PAYLOAD,
} from './template-test';

const STAFF_ID = 'staff-1';
const APP_USER_ID = 'pai-1';

function fakeNotification() {
  const sent: SendNotificationParams[] = [];
  const notification = {
    useCases: {
      sendNotification: {
        async execute(params: SendNotificationParams) {
          sent.push(params);
          return {
            notificationId: `n-${sent.length}`,
            deduplicated: false,
            deliveries: [
              { id: 'd1', notificationId: `n-${sent.length}`, channel: 'push', status: 'queued', attempt: 0 },
              { id: 'd2', notificationId: `n-${sent.length}`, channel: 'inbox', status: 'sent', attempt: 1 },
            ],
          };
        },
      },
    },
  } as unknown as Pick<NotificationModule, 'useCases'>;
  return { notification, sent };
}

describe('categoryForTemplateKey', () => {
  it('le a categoria pelo prefixo da chave', () => {
    expect(categoryForTemplateKey('atividade_lembrete')).toBe('atividades');
    expect(categoryForTemplateKey('atividades.agendada')).toBe('atividades');
    expect(categoryForTemplateKey('comunidade.comentario')).toBe('comunidade');
    expect(categoryForTemplateKey('boletim_conquista')).toBe('boletim');
    expect(categoryForTemplateKey('insight_semanal')).toBe('boletim');
    expect(categoryForTemplateKey('avisos.plataforma')).toBe('avisos');
  });

  it('modelo criado no painel com outra chave cai em avisos', () => {
    expect(categoryForTemplateKey('promocao_natal')).toBe('avisos');
  });
});

describe('createSendTemplateTest', () => {
  it('envia o modelo para a conta do app de quem esta logado, com o payload de exemplo', async () => {
    const { notification, sent } = fakeNotification();
    const sendTest = createSendTemplateTest({
      notification,
      findAppUserIdForStaff: async (staffId) => (staffId === STAFF_ID ? APP_USER_ID : undefined),
      newDedupeKey: () => 'chave-fixa',
    });

    const result = await sendTest({ staffUserId: STAFF_ID, templateKey: 'atividade_lembrete' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.recipientUserId).toBe(APP_USER_ID);
    expect(sent[0]?.templateKey).toBe('atividade_lembrete');
    expect(sent[0]?.category).toBe('atividades');
    expect(sent[0]?.payload).toEqual(TEMPLATE_TEST_PAYLOAD);
    expect(sent[0]?.dedupeKey).toBe('chave-fixa');
    expect(result.deliveries).toEqual([
      { channel: 'push', status: 'queued' },
      { channel: 'inbox', status: 'sent' },
    ]);
  });

  it('usa uma chave de deduplicacao nova a cada clique', async () => {
    const { notification, sent } = fakeNotification();
    const sendTest = createSendTemplateTest({ notification, findAppUserIdForStaff: async () => APP_USER_ID });

    await sendTest({ staffUserId: STAFF_ID, templateKey: 'avisos.plataforma' });
    await sendTest({ staffUserId: STAFF_ID, templateKey: 'avisos.plataforma' });

    expect(sent[0]?.dedupeKey).not.toBe(sent[1]?.dedupeKey);
  });

  it('sem conta no app com o mesmo e-mail, recusa sem enviar nada', async () => {
    const { notification, sent } = fakeNotification();
    const sendTest = createSendTemplateTest({ notification, findAppUserIdForStaff: async () => undefined });

    await expect(sendTest({ staffUserId: STAFF_ID, templateKey: 'avisos.plataforma' })).rejects.toBeInstanceOf(
      AppAccountNotFoundError,
    );
    expect(sent).toHaveLength(0);
  });

  it('chave vazia e' + "'" + ' erro de validacao', async () => {
    const { notification } = fakeNotification();
    const sendTest = createSendTemplateTest({ notification, findAppUserIdForStaff: async () => APP_USER_ID });

    await expect(sendTest({ staffUserId: STAFF_ID, templateKey: '  ' })).rejects.toBeInstanceOf(InvalidTemplateKeyError);
  });
});
