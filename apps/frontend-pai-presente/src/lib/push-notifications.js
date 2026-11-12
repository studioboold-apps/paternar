/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Gerenciador de inscricao e permissao de Web Push no navegador.
 */

import { request } from '@/api/http';

export const PUSH_STORAGE_KEYS = Object.freeze({
  DISMISSED: 'paternar:push:dismissed',
  DEVICE_ID: 'paternar:push:device-id',
});

const DEFAULT_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64Url(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isPushSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function isPushDismissed(storageKey = PUSH_STORAGE_KEYS.DISMISSED, ttlMs = DEFAULT_DISMISS_TTL_MS) {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (!parsed?.dismissedAt) return false;

    if (ttlMs > 0 && Date.now() - parsed.dismissedAt > ttlMs) {
      window.localStorage.removeItem(storageKey);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function dismissPush(storageKey = PUSH_STORAGE_KEYS.DISMISSED) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ dismissedAt: Date.now() }));
  } catch {
    // Silently ignore storage quota errors
  }
}

export function resetDismissedPush(storageKey = PUSH_STORAGE_KEYS.DISMISSED) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Silently ignore storage errors
  }
}

export async function isPushSubscribed() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

function sameKey(current, expected) {
  if (!current) return true;
  const a = new Uint8Array(current);
  if (a.length !== expected.length) return false;
  return a.every((byte, index) => byte === expected[index]);
}

/**
 * Cadastra ESTE aparelho na API para receber push. Nao pede permissao: so roda
 * com ela ja concedida. Devolve `true` apenas quando a API confirmou o aparelho;
 * permissao do navegador sozinha nao faz push chegar.
 *
 * Idempotente (a API "registra ou reativa"): roda de novo a cada abertura do
 * app, e assim conserta o aparelho que deu permissao antes de a chave VAPID
 * existir no servidor, ou cuja inscricao o navegador trocou.
 */
export async function registerPushDevice(deps = { request }) {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;

  try {
    const vapidResponse = await deps.request('GET', '/v1/push/vapid-public-key');
    const vapidPublicKey = vapidResponse?.publicKey;
    // Sem chave no servidor nao ha push: dizer "ativo" aqui era mentir para o pai.
    if (!vapidPublicKey) return false;

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    // Inscricao feita com outra chave nunca recebe: refaz com a atual.
    if (subscription && !sameKey(subscription.options?.applicationServerKey, applicationServerKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    }

    const subscriptionPayload = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64Url(subscription.getKey('auth')),
      },
      expirationTime: subscription.expirationTime,
    };

    const device = await deps.request('POST', '/v1/notification-devices', {
      body: { platform: 'web', driver: 'webpush', token: JSON.stringify(subscriptionPayload) },
    });
    if (!device?.id) return false;

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PUSH_STORAGE_KEYS.DEVICE_ID, device.id);
    }
    resetDismissedPush();
    return true;
  } catch {
    return false;
  }
}

/** Pede a permissao (se ainda nao houver) e cadastra o aparelho. */
export async function subscribeToPush(deps = { request }) {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  return registerPushDevice(deps);
}

/**
 * Remove a inscricao ativa de Web Push e desvincula o aparelho na API.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return true;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const deviceId = window.localStorage.getItem(PUSH_STORAGE_KEYS.DEVICE_ID);
      if (deviceId) {
        await request('DELETE', `/v1/notification-devices/${deviceId}`).catch(() => undefined);
        window.localStorage.removeItem(PUSH_STORAGE_KEYS.DEVICE_ID);
      }
    }

    return true;
  } catch {
    return false;
  }
}
