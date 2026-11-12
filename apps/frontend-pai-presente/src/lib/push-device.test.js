/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { registerPushDevice, urlBase64ToUint8Array } from './push-notifications';

const KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9tWVHRZ6w0o4VNf55J15D34q7EHoOx6mdEDGDeVelRGCdg';
const OTHER_KEY = 'BLtHQNmv2LTZlWwMJrukZXVZCVEmOo7SznJi8_FzkXETcJTz6bxmzg5-b0m9JTUmu6205GmYaXqzwMCs5dZ5Y4c';

function fakeSubscription(key, log) {
  return {
    endpoint: 'https://push.example/abc',
    expirationTime: null,
    options: { applicationServerKey: urlBase64ToUint8Array(key).buffer },
    getKey: (name) => new Uint8Array(name === 'p256dh' ? [1, 2, 3] : [4, 5]).buffer,
    unsubscribe: async () => log.push('unsubscribe'),
  };
}

/** Navegador falso: permissao, service worker e pushManager. */
function installBrowser({ permission = 'granted', existingKey } = {}) {
  const log = [];
  let current = existingKey ? fakeSubscription(existingKey, log) : null;
  const pushManager = {
    getSubscription: async () => current,
    subscribe: async ({ applicationServerKey }) => {
      log.push('subscribe');
      const encoded = Buffer.from(applicationServerKey).toString('base64url');
      current = fakeSubscription(encoded, log);
      return current;
    },
  };
  globalThis.window = globalThis;
  globalThis.PushManager = function PushManager() {};
  globalThis.Notification = { permission };
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager }) },
    configurable: true,
  });
  return log;
}

function fakeApi(vapidKey, deviceId = 'dev-1') {
  const calls = [];
  return {
    calls,
    request: async (method, path, options) => {
      calls.push({ method, path, body: options?.body });
      if (path === '/v1/push/vapid-public-key') return vapidKey ? { publicKey: vapidKey } : {};
      return { id: deviceId };
    },
  };
}

describe('registerPushDevice', () => {
  beforeEach(() => {
    delete globalThis.window;
  });
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.PushManager;
    delete globalThis.Notification;
    delete globalThis.navigator.serviceWorker;
  });

  it('com permissao dada, inscreve e cadastra o aparelho na API', async () => {
    const log = installBrowser();
    const api = fakeApi(KEY);

    expect(await registerPushDevice(api)).toBe(true);
    expect(log).toEqual(['subscribe']);
    const device = api.calls.find((call) => call.path === '/v1/notification-devices');
    expect(device.body.driver).toBe('webpush');
    expect(JSON.parse(device.body.token).endpoint).toBe('https://push.example/abc');
  });

  it('sem chave VAPID no servidor, nao diz que esta ativo', async () => {
    installBrowser();
    expect(await registerPushDevice(fakeApi(undefined))).toBe(false);
  });

  it('sem permissao, nao chama a API', async () => {
    installBrowser({ permission: 'default' });
    const api = fakeApi(KEY);
    expect(await registerPushDevice(api)).toBe(false);
    expect(api.calls).toHaveLength(0);
  });

  it('inscricao feita com outra chave e' + "'" + ' refeita com a atual', async () => {
    const log = installBrowser({ existingKey: OTHER_KEY });
    expect(await registerPushDevice(fakeApi(KEY))).toBe(true);
    expect(log).toEqual(['unsubscribe', 'subscribe']);
  });

  it('inscricao com a mesma chave so e' + "'" + ' recadastrada na API', async () => {
    const log = installBrowser({ existingKey: KEY });
    const api = fakeApi(KEY);
    expect(await registerPushDevice(api)).toBe(true);
    expect(log).toEqual([]);
    expect(api.calls.some((call) => call.path === '/v1/notification-devices')).toBe(true);
  });
});
