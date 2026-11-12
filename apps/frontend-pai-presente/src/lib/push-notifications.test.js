/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';

import {
  arrayBufferToBase64Url,
  dismissPush,
  getNotificationPermission,
  isPushDismissed,
  isPushSupported,
  resetDismissedPush,
  urlBase64ToUint8Array,
} from './push-notifications';

describe('push-notifications utilities', () => {
  const TEST_KEY = 'test:paternar:push:dismissed';

  it('urlBase64ToUint8Array converte chave VAPID base64url para Uint8Array', () => {
    const rawB64 = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9tWVHRZ6w0o4VNf55J15D34q7EHoOx6mdEDGDeVelRGCdg';
    const arr = urlBase64ToUint8Array(rawB64);
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.length).toBe(65);

    const restored = arrayBufferToBase64Url(arr.buffer);
    expect(restored).toBe(rawB64);
  });

  it('arrayBufferToBase64Url devolve string vazia para buffer nulo', () => {
    expect(arrayBufferToBase64Url(null)).toBe('');
  });

  it('isPushSupported e getNotificationPermission tratam ambiente sem navegador nativo', () => {
    expect(typeof isPushSupported()).toBe('boolean');
    expect(getNotificationPermission()).toBe('unsupported');
  });

  it('isPushDismissed gerencia TTL e persistencia no storage', () => {
    const map = new Map();
    const storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => { map.set(k, v); },
      removeItem: (k) => { map.delete(k); },
    };

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true,
      writable: true,
    });

    expect(isPushDismissed(TEST_KEY, 1000)).toBe(false);

    dismissPush(TEST_KEY);
    expect(isPushDismissed(TEST_KEY, 5000)).toBe(true);

    // Registro expirado
    map.set(TEST_KEY, JSON.stringify({ dismissedAt: Date.now() - 10000 }));
    expect(isPushDismissed(TEST_KEY, 5000)).toBe(false);

    resetDismissedPush(TEST_KEY);
    expect(map.has(TEST_KEY)).toBe(false);

    Reflect.deleteProperty(globalThis, 'window');
  });
});
