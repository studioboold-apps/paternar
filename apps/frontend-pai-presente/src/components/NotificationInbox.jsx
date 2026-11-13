/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O sininho do app dos pais: contador de nao lidas e a caixa de entrada.
 *
 * A API ja gravava as mensagens do canal "No app" (inbox) — atividade
 * agendada, lembrete, comentario na comunidade, aviso da equipe —, mas o app
 * nao tinha onde mostra-las: o pai so via o push, e quem nao liberou push nao
 * via nada. As telas sao as do SDK da casa (`@adatechnology/notification-ui`),
 * as mesmas do painel; aqui so entram a sessao do pai e as cores da marca.
 */

import React, { useMemo, useState } from 'react';
import { NotificationBell, NotificationList, NotificationProvider } from '@adatechnology/notification-ui';
import { createNotificationClient } from '@adatechnology/notification-client';
import '@adatechnology/notification-ui/styles.css';

import { apiBaseUrl, fetchWithSession } from '@/api/http';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/lib/i18n';
import { buildNotificationBaseUrl, toNotificationLocale } from '@/lib/notification-inbox';
import { cn } from '@/lib/utils';

/**
 * Tokens do SDK apontados para a paleta da marca (`index.css`). Explicitos de
 * proposito: sem eles, o celular em modo escuro pintava a lista de azul-marinho
 * no meio de um app claro.
 */
const INBOX_THEME = Object.freeze({ rootClassName: 'paternar-inbox' });

/** Contador sem SSE: o stream exige cookie no EventSource e uma replica so. */
const POLL_INTERVAL_SECONDS = 60;

const notificationClient = createNotificationClient({
  baseUrl: buildNotificationBaseUrl(apiBaseUrl()),
  fetchImpl: fetchWithSession,
});

export default function NotificationInbox({ className }) {
  const { t, locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const notificationLocale = toNotificationLocale(locale);

  const messageOverrides = useMemo(
    () => ({
      'bell.label': t('notificationInbox.bell'),
      'list.title': t('notificationInbox.title'),
      'list.empty': t('notificationInbox.empty'),
    }),
    [t],
  );

  return (
    <NotificationProvider
      client={notificationClient}
      locale={notificationLocale}
      messageOverrides={messageOverrides}
      theme={INBOX_THEME}
      pollIntervalSeconds={POLL_INTERVAL_SECONDS}
    >
      <NotificationBell onClick={() => setIsOpen(true)} className={cn('text-zinc-300', className)} />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-zinc-950 border-zinc-800 p-0">
          <SheetTitle className="sr-only">{t('notificationInbox.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('notificationInbox.description')}</SheetDescription>
          {/* So monta aberta: a lista busca a pagina quando o pai olha, nao a cada tela. */}
          {isOpen ? <NotificationList className="pt-10" /> : null}
        </SheetContent>
      </Sheet>
    </NotificationProvider>
  );
}
