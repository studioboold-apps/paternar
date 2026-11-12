/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  getLastPushFailure,
  isPushOptedOut,
  PUSH_STORAGE_KEYS,
  registerPushDevice,
  unsubscribeFromPush,
  urlBase64ToUint8Array,
} from './push-notifications';

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
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
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
      // Como o `request` de verdade devolve: chaves em snake_case.
      if (path === '/v1/push/vapid-public-key') return vapidKey ? { public_key: vapidKey } : {};
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
    delete globalThis.localStorage;
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

  it('depois de desativar, a abertura do app nao cadastra o aparelho de novo', async () => {
    installBrowser({ existingKey: KEY });
    expect(await unsubscribeFromPush()).toBe(true);
    expect(isPushOptedOut()).toBe(true);

    const api = fakeApi(KEY);
    expect(await registerPushDevice(api, { automatic: true })).toBe(false);
    expect(api.calls).toHaveLength(0);
  });

  it('ativar de novo pelo botao vale mesmo depois de desativar', async () => {
    installBrowser();
    globalThis.localStorage.setItem(PUSH_STORAGE_KEYS.OPTED_OUT, '1');
    expect(await registerPushDevice(fakeApi(KEY))).toBe(true);
  });

  it('diz em que passo parou quando nao consegue ativar', async () => {
    installBrowser();
    expect(await registerPushDevice(fakeApi(undefined))).toBe(false);
    expect(getLastPushFailure()).toBe('servidor-sem-chave-vapid');
  });

  it('recusa chave VAPID que nao e' + "'" + ' um ponto P-256 (ex.: chave privada no lugar da publica)', async () => {
    const log = installBrowser();
    expect(await registerPushDevice(fakeApi('Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmE'))).toBe(false);
    expect(getLastPushFailure()).toContain('chave-vapid-invalida');
    expect(log).toEqual([]);
  });

  it('erro do navegador ao inscrever aparece com o nome do erro', async () => {
    installBrowser();
    globalThis.navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.subscribe = async () => {
        throw Object.assign(new Error('push service error'), { name: 'AbortError' });
      };
    });
    await globalThis.navigator.serviceWorker.ready;
    expect(await registerPushDevice(fakeApi(KEY))).toBe(false);
    expect(getLastPushFailure()).toBe('inscricao-do-navegador-falhou (AbortError: push service error)');
  });

  it('API que recusa o aparelho aparece como falha da API', async () => {
    installBrowser();
    const api = fakeApi(KEY);
    const original = api.request;
    api.request = async (method, path, options) => {
      if (path === '/v1/notification-devices') throw new Error('HTTP 400');
      return original(method, path, options);
    };
    expect(await registerPushDevice(api)).toBe(false);
    expect(getLastPushFailure()).toContain('api-recusou-o-aparelho');
  });
});
