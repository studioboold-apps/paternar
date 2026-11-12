/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Banner acessivel para convidar a ativar notificacoes e permitir sua desativacao.
 */

import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  dismissPush,
  getNotificationPermission,
  isPushDismissed,
  registerPushDevice,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getLastPushFailure,
} from '@/lib/push-notifications';

export default function NotificationPermissionBanner({
  showWhenGranted = false,
  showWhenDenied = true,
  className,
  onDismiss,
}) {
  const { t } = useTranslation();
  const [permission, setPermission] = useState(() => getNotificationPermission());
  // `null` enquanto confere com a API; depois, se ESTE aparelho esta cadastrado.
  const [isSubscribed, setIsSubscribed] = useState(null);
  const [isDismissed, setIsDismissed] = useState(() => isPushDismissed());
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
    setIsDismissed(isPushDismissed());

    // Com permissao ja dada, (re)cadastra o aparelho a cada abertura: quem
    // ativou antes de o servidor ter chave VAPID ficava "ativo" sem aparelho.
    if (isPushSupported() && getNotificationPermission() === 'granted') {
      registerPushDevice(undefined, { automatic: true })
        .then(setIsSubscribed)
        .catch(() => setIsSubscribed(false));
    }
  }, []);

  if (!isPushSupported() || permission === 'unsupported') {
    return null;
  }

  const handleDismiss = () => {
    dismissPush();
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleSubscribe = async () => {
    setIsBusy(true);
    try {
      const success = await subscribeToPush();
      setPermission(getNotificationPermission());
      setIsSubscribed(success);
      setFailure(success ? null : getLastPushFailure());
      if (success) setIsDismissed(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsBusy(true);
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
    } finally {
      setIsBusy(false);
    }
  };

  // 1. Estado Prompt: convite amigavel para permitir notificacoes
  if (permission === 'default') {
    if (isDismissed) return null;

    return (
      <aside
        className={cn(
          'flex items-start gap-3.5 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-zinc-100',
          className
        )}
        role="region"
        aria-label={t('notificationBanner.title')}
      >
        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
          <Bell aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">
            {t('notificationBanner.title')}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {t('notificationBanner.description')}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button
              type="button"
              size="sm"
              onClick={handleSubscribe}
              disabled={isBusy}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-3 rounded-lg"
            >
              {isBusy && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {t('notificationBanner.allow')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-zinc-400 hover:text-zinc-200 text-xs h-8 px-3 rounded-lg"
            >
              {t('notificationBanner.dismiss')}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-zinc-200 p-1 -mr-1 -mt-1 rounded-lg shrink-0 cursor-pointer"
          aria-label={t('notificationBanner.dismiss')}
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  // 2. Permissao dada, mas este aparelho nao esta cadastrado (ou ainda conferindo)
  if (permission === 'granted' && isSubscribed !== true) {
    if (!showWhenGranted || isSubscribed === null) return null;

    return (
      <aside
        className={cn(
          'flex items-start gap-3.5 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-zinc-100',
          className
        )}
        role="region"
        aria-label={t('notificationBanner.inactiveTitle')}
      >
        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
          <Bell aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">
            {t('notificationBanner.inactiveTitle')}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {t('notificationBanner.inactiveDescription')}
          </p>
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              onClick={handleSubscribe}
              disabled={isBusy}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-3 rounded-lg"
            >
              {isBusy && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {t('notificationBanner.enableHere')}
            </Button>
            {failure && (
              <p role="alert" className="text-xs text-red-400 mt-2 break-words">
                {t('notificationBanner.enableFailed', { reason: failure })}
              </p>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // 3. Estado Ativo: aparelho cadastrado, opcao de desativacao
  if (permission === 'granted') {
    if (!showWhenGranted) return null;

    return (
      <aside
        className={cn(
          'flex items-start gap-3.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-zinc-100',
          className
        )}
        role="region"
        aria-label={t('notificationBanner.activeTitle')}
      >
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
          <BellRing aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">
            {t('notificationBanner.activeTitle')}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {t('notificationBanner.activeDescription')}
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUnsubscribe}
              disabled={isBusy}
              className="border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400 text-xs h-8 px-3 rounded-lg bg-transparent"
            >
              {isBusy && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isBusy ? t('notificationBanner.disabling') : t('notificationBanner.disable')}
            </Button>
          </div>
        </div>
      </aside>
    );
  }

  // 4. Estado Bloqueado: aviso de que o navegador bloqueou notificacoes
  if (permission === 'denied') {
    if (!showWhenDenied || isDismissed) return null;

    return (
      <aside
        className={cn(
          'flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-zinc-100',
          className
        )}
        role="alert"
        aria-label={t('notificationBanner.deniedTitle')}
      >
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
          <BellOff aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">
            {t('notificationBanner.deniedTitle')}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {t('notificationBanner.deniedDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-zinc-200 p-1 -mr-1 -mt-1 rounded-lg shrink-0 cursor-pointer"
          aria-label={t('notificationBanner.dismiss')}
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return null;
}
