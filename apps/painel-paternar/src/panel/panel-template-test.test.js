/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import { describeTemplateTestError, describeTemplateTestResult, sendTemplateTest } from './panel-template-test';

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
    expect(calls).toEqual([['POST', '/notification-templates/avisos.plataforma/test']]);
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
});
