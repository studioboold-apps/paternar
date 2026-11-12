/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Secao de gestao de notificacoes do pai (Web Push).
 */

import React from 'react';
import { Bell } from 'lucide-react';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import { useTranslation } from '@/lib/i18n';

export default function PerfilNotificationSection() {
  const { t } = useTranslation();

  return (
    <div className="px-4 mb-6">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell aria-hidden="true" className="w-5 h-5 text-zinc-400" />
          <h2 className="font-medium text-zinc-100">
            {t('notificationBanner.title')}
          </h2>
        </div>
        <NotificationPermissionBanner showWhenGranted={true} showWhenDenied={true} />
      </div>
    </div>
  );
}
