/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Gestao de notificacoes (canais, politicas e templates) via @adatechnology/notification-ui.
 */

import React, { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationProvider, NotificationSettingsWorkspace } from '@adatechnology/notification-ui';
import '@adatechnology/notification-ui/styles.css';

import { createPanelNotificationClient } from './panel-apis';
import { PANEL_TEXT } from './panel-text';
import { PageHeader } from './panel-ui';
import PanelTemplateTestButton from './PanelTemplateTestButton';
import { SEND_ANY_SCOPE } from './panel-template-test';

const NOTIFICATION_CHANNELS = [
  { id: 'inbox', label: 'Mensagem no app (Inbox)', hint: 'Aviso interno na caixa de entrada do aplicativo' },
  { id: 'push', label: 'Notificação Push', hint: 'Notificação instantânea na tela do celular ou navegador' },
  { id: 'email', label: 'E-mail', hint: 'Mensagem de correio eletrônico aos pais cadastrados' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Mensagem via WhatsApp pelo número cadastrado' },
];

const NOTIFICATION_CATEGORIES = [
  { id: 'atividades', label: 'Atividades e Rotina', hint: 'Lembretes de atividades e rotina com os filhos' },
  { id: 'comunidade', label: 'Comunidade', hint: 'Interações, respostas e avisos da comunidade de pais' },
  { id: 'boletim', label: 'Boletim e Conquistas', hint: 'Marcos de desenvolvimento e evolução' },
  { id: 'avisos', label: 'Avisos da Plataforma', hint: 'Comunicações gerais, novidades e avisos importantes' },
];

/**
 * Exemplo para o preview de modelo criado aqui no painel, que nao tem catalogo
 * na API. Os modelos padrao recebem os exemplos do catalogo da propria API.
 */
const PREVIEW_PAYLOAD = Object.freeze({
  title: 'Piquenique no parque',
  description: 'Levar a bola e a toalha xadrez.',
  activityDate: '15/11/2026',
  activityTime: ' às 10:00',
  childName: 'Miguel',
  commentText: 'Que ideia boa! Vou fazer com a minha filha.',
  summary: 'Vocês fizeram 3 atividades juntos esta semana.',
});

export default function PanelNotifications({ client, can }) {
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  }), []);
  const notificationClient = useMemo(() => createPanelNotificationClient(client), [client]);

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider client={notificationClient}>
        <PageHeader
          title={PANEL_TEXT.tabs.notifications}
          description={PANEL_TEXT.notifications.description}
        />
        <div className="mt-6 rounded-2xl bg-zinc-900/60 p-6 border border-zinc-800 text-zinc-100">
          <NotificationSettingsWorkspace
            channels={NOTIFICATION_CHANNELS}
            categories={NOTIFICATION_CATEGORIES}
            senderName="Paternar"
            previewPayload={PREVIEW_PAYLOAD}
            renderEditorActions={({ templateKey }) => (
              <PanelTemplateTestButton
                client={client}
                templateKey={templateKey}
                canChooseRecipient={Boolean(can?.(SEND_ANY_SCOPE))}
              />
            )}
          />
        </div>
      </NotificationProvider>
    </QueryClientProvider>
  );
}
