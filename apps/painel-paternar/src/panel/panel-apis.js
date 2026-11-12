/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Os clientes que as telas do SDK pedem (`customers-ui`, `recommendations-ui`),
 * montados sobre a sessao da equipe. As telas nao sabem de token: recebem um
 * objeto com metodos, e o token entra aqui.
 */

import { createNotificationClient } from '@adatechnology/notification-client';
import { createFetchRecommendationsApi } from '@adatechnology/recommendations-ui';

const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

/** @param {ReturnType<typeof import('./panel-client').createPanelClient>} client */
export function createCustomersApi(client) {
  const data = async (promise) => (await promise)?.data;
  const id = (value) => encodeURIComponent(value);
  return {
    listCustomers: (params) => client.requestJson('GET', `/customers${query(params)}`),
    getCustomer: (customerId) => data(client.requestJson('GET', `/customers/${id(customerId)}`)),
    getSettings: () => data(client.requestJson('GET', '/customer-settings')),
    createCustomer: (input) => data(client.requestJson('POST', '/customers', input)),
    updateCustomer: (customerId, input) => client.requestJson('PATCH', `/customers/${id(customerId)}`, input),
    setDocument: (customerId, document) => client.requestJson('PUT', `/customers/${id(customerId)}/documents`, document),
    addAddress: (customerId, address) => data(client.requestJson('POST', `/customers/${id(customerId)}/addresses`, address)),
    updateAddress: (customerId, addressId, address) =>
      data(client.requestJson('PATCH', `/customers/${id(customerId)}/addresses/${id(addressId)}`, address)),
    removeAddress: (customerId, addressId) =>
      client.requestJson('DELETE', `/customers/${id(customerId)}/addresses/${id(addressId)}`),
    updateSettings: (input) => data(client.requestJson('PUT', '/customer-settings', input)),
  };
}

/** @param {ReturnType<typeof import('./panel-client').createPanelClient>} client */
export function createPanelRecommendationsApi(client) {
  return createFetchRecommendationsApi({ baseUrl: client.root, fetch: client.authorizedFetch });
}

/** @param {ReturnType<typeof import('./panel-client').createPanelClient>} client */
export function createPanelNotificationClient(client) {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
  const baseUrl = client.root.startsWith('http') ? client.root : `${origin}${client.root}`;
  return createNotificationClient({
    baseUrl,
    fetchImpl: client.authorizedFetch,
  });
}

/** Todos os anunciantes para o seletor da recomendacao patrocinada. */
export async function listSponsorOptions(client) {
  const page = await client.requestJson('GET', '/customers?page=1&perPage=100');
  return (page?.data ?? []).map((customer) => ({ id: customer.id, label: customer.name || customer.email || customer.id }));
}
