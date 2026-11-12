/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import {
  describeTemplateTestError,
  describeTemplateTestResult,
  searchTestRecipients,
  sendTemplateTest,
} from './panel-template-test';

describe('enviar teste para mim', () => {
  test('chama a rota do modelo aberto sem destinatario no corpo', async () => {
    const calls = [];
    const client = {
      requestJson: async (...args) => {
        calls.push(args);
        return { data: { notificationId: 'n1', deliveries: [] } };
      },
    };
    const result = await sendTemplateTest(client, 'avisos.plataforma');
    expect(calls).toEqual([['POST', '/notification-templates/avisos.plataforma/test', undefined]]);
    expect(result.notificationId).toBe('n1');
  });

  test('com push na entrega, pede para conferir o celular', () => {
    const view = describeTemplateTestResult({ deliveries: [{ channel: 'inbox' }, { channel: 'push' }] });
    expect(view.ok).toBe(true);
    expect(view.text).toContain('Confira o celular');
  });

  test('sem push, explica que o aparelho precisa ativar as notificacoes', () => {
    const view = describeTemplateTestResult({ deliveries: [{ channel: 'inbox' }] });
    expect(view.text).toContain('ative as notificações');
  });

  test('sem nenhuma entrega, avisa que nada foi enviado', () => {
    expect(describeTemplateTestResult({ deliveries: [] }).ok).toBe(false);
  });

  test('sem conta no app, diz o que fazer', () => {
    expect(describeTemplateTestError({ code: 'APP_ACCOUNT_NOT_FOUND' })).toContain('mesmo e-mail');
  });

  test('admin escolhe o pai: o id vai no corpo', async () => {
    const calls = [];
    const client = { requestJson: async (...args) => (calls.push(args), { data: {} }) };
    await sendTemplateTest(client, 'avisos.plataforma', 'pai-9');
    expect(calls[0][2]).toEqual({ recipientUserId: 'pai-9' });
  });

  test('busca de pais ignora termo curto e esconde bloqueados', async () => {
    const calls = [];
    const client = {
      requestJson: async (...args) => {
        calls.push(args);
        return {
          data: [
            { id: 'a', fullName: 'Ana Pai', email: 'ana@x.com', blockedAt: null },
            { id: 'b', fullName: null, email: 'bloq@x.com', blockedAt: '2026-01-01' },
          ],
        };
      },
    };
    expect(await searchTestRecipients(client, 'a')).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(await searchTestRecipients(client, 'ana')).toEqual([{ id: 'a', label: 'Ana Pai (ana@x.com)' }]);
  });

  test('para outro pai, a mensagem diz para quem foi', () => {
    const view = describeTemplateTestResult({ deliveries: [{ channel: 'push' }] }, 'Ana Pai');
    expect(view.text).toContain('para Ana Pai');
  });
});
