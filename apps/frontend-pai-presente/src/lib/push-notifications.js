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
  /** O pai desligou neste aparelho: o cadastro automatico na abertura nao religa. */
  OPTED_OUT: 'paternar:push:opted-out',
});

function readStorage(key) {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponivel (aba anonima, cota): segue sem lembrar.
  }
}

export function isPushOptedOut() {
  return readStorage(PUSH_STORAGE_KEYS.OPTED_OUT) === '1';
}

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

/** Quanto esperar o service worker ficar pronto antes de desistir. */
const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

/**
 * Motivo da ultima falha ao cadastrar o aparelho, para a tela mostrar. Sem ele
 * o botao so voltava ao mesmo estado e ninguem sabia em que passo parou.
 */
let lastPushFailure = null;

export function getLastPushFailure() {
  return lastPushFailure;
}

function fail(reason, error) {
  const detail = error?.name || error?.message ? `${error.name ?? 'Error'}: ${error.message ?? ''}`.trim() : '';
  lastPushFailure = detail ? `${reason} (${detail})` : reason;
  return false;
}

/**
 * `navigator.serviceWorker.ready` nunca resolve se o service worker nao
 * registrar: o botao ficava girando para sempre.
 */
function serviceWorkerReady(timeoutMs = SERVICE_WORKER_READY_TIMEOUT_MS) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('service worker nao ficou pronto')), timeoutMs);
    }),
  ]);
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
export async function registerPushDevice(deps = { request }, { automatic = false } = {}) {
  lastPushFailure = null;
  if (!isPushSupported()) return fail('navegador-sem-push');
  if (Notification.permission !== 'granted') return fail('permissao-negada');
  if (automatic && isPushOptedOut()) return false;

  let vapidPublicKey;
  try {
    const vapidResponse = await deps.request('GET', '/v1/push/vapid-public-key');
    // `request` devolve as chaves em snake_case (`toPagePayload`): `publicKey`
    // chega como `public_key`. Ler so `publicKey` dava "sem chave" sempre, e
    // nenhum aparelho era cadastrado.
    vapidPublicKey = vapidResponse?.public_key ?? vapidResponse?.publicKey;
  } catch (error) {
    return fail('chave-vapid-indisponivel', error);
  }
  // Sem chave no servidor nao ha push: dizer "ativo" aqui era mentir para o pai.
  if (!vapidPublicKey) return fail('servidor-sem-chave-vapid');

  let applicationServerKey;
  try {
    applicationServerKey = urlBase64ToUint8Array(String(vapidPublicKey).trim());
  } catch (error) {
    return fail('chave-vapid-invalida', error);
  }
  // Chave publica VAPID e um ponto P-256 sem compressao: 65 bytes, comecando em 4.
  if (applicationServerKey.length !== 65 || applicationServerKey[0] !== 4) {
    return fail(`chave-vapid-invalida (${applicationServerKey.length} bytes)`);
  }

  let registration;
  try {
    registration = await serviceWorkerReady();
  } catch (error) {
    return fail('service-worker-indisponivel', error);
  }

  let subscription;
  try {
    subscription = await registration.pushManager.getSubscription();
    // Inscricao feita com outra chave nunca recebe: refaz com a atual.
    if (subscription && !sameKey(subscription.options?.applicationServerKey, applicationServerKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    }
  } catch (error) {
    return fail('inscricao-do-navegador-falhou', error);
  }

  const subscriptionPayload = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64Url(subscription.getKey('auth')),
    },
    expirationTime: subscription.expirationTime,
  };

  let device;
  try {
    device = await deps.request('POST', '/v1/notification-devices', {
      body: { platform: 'web', driver: 'webpush', token: JSON.stringify(subscriptionPayload) },
    });
  } catch (error) {
    return fail('api-recusou-o-aparelho', error);
  }
  if (!device?.id) return fail('api-nao-devolveu-o-aparelho');

  writeStorage(PUSH_STORAGE_KEYS.DEVICE_ID, device.id);
  resetDismissedPush();
  return true;
}

/** Pede a permissao (se ainda nao houver) e cadastra o aparelho. */
export async function subscribeToPush(deps = { request }) {
  lastPushFailure = null;
  if (!isPushSupported()) return fail('navegador-sem-push');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return fail('permissao-negada');
  writeStorage(PUSH_STORAGE_KEYS.OPTED_OUT, null);
  return registerPushDevice(deps);
}

/**
 * Remove a inscricao ativa de Web Push e desvincula o aparelho na API.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return true;
  // A permissao do navegador continua "granted" (o site nao consegue revoga-la):
  // sem esta marca, a proxima abertura do app cadastraria o aparelho de novo.
  writeStorage(PUSH_STORAGE_KEYS.OPTED_OUT, '1');

  try {
    const registration = await serviceWorkerReady();
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
