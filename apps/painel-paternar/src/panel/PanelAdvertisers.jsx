/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Anunciantes = clientes do `customer-module`. Lista, ficha e configuracao de
 * campos vem prontas do `customers-ui`; o cadastro novo e' daqui, porque o
 * pacote deixa a criacao para o host.
 */

import React, { useMemo, useState } from 'react';
import {
  CustomerDetail,
  CustomerList,
  CustomerSettingsPage,
  CustomersProvider,
  useCustomerSettings,
} from '@adatechnology/customers-ui';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createCustomersApi } from './panel-apis';
import { PANEL_TEXT } from './panel-text';
import { PageHeader } from './panel-ui';

const CATEGORY_FIELD = 'categoria';
const text = PANEL_TEXT.advertisers;

function NewAdvertiser({ api, onCreated }) {
  const { settings } = useCustomerSettings();
  const categories = settings?.fieldCatalog.find((field) => field.name === CATEGORY_FIELD)?.options ?? [];
  const [form, setForm] = useState({ name: '', phone: '', email: '', category: '' });
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const created = await api.createCustomer({
        name: form.name.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        phones: form.phone.trim() ? [{ number: form.phone, isWhatsApp: true }] : [],
        attributes: form.category ? { [CATEGORY_FIELD]: form.category } : {},
      });
      onCreated(created.id);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-zinc-800 bg-white p-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm text-zinc-300 sm:col-span-2">
        <span>{text.name}</span>
        <Input required value={form.name} onChange={set('name')} />
      </label>
      <label className="space-y-1 text-sm text-zinc-300">
        <span>{text.phone}</span>
        <Input inputMode="tel" value={form.phone} onChange={set('phone')} />
      </label>
      <label className="space-y-1 text-sm text-zinc-300">
        <span>{text.email}</span>
        <Input type="email" value={form.email} onChange={set('email')} />
      </label>
      <label className="space-y-1 text-sm text-zinc-300 sm:col-span-2">
        <span>{text.category}</span>
        <select className="w-full rounded-md border border-zinc-800 bg-white px-3 py-2 text-sm" value={form.category} onChange={set('category')}>
          <option value="" />
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit">{text.save}</Button>
      </div>
    </form>
  );
}

export default function PanelAdvertisers({ client }) {
  const api = useMemo(() => createCustomersApi(client), [client]);
  const [view, setView] = useState({ mode: 'list' });

  return (
    <CustomersProvider api={api}>
      <div className="space-y-4">
        <PageHeader title={PANEL_TEXT.tabs.advertisers} description={text.description} />
        <div className="flex flex-wrap gap-2">
          {view.mode === 'list' ? (
            <Button variant="outline" size="sm" onClick={() => setView({ mode: 'settings' })}>
              {text.settings}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setView({ mode: 'list' })}>
              {text.back}
            </Button>
          )}
        </div>
        {view.mode === 'list' ? (
          <CustomerList onSelect={(customer) => setView({ mode: 'detail', id: customer.id })} onCreate={() => setView({ mode: 'new' })} />
        ) : null}
        {view.mode === 'new' ? <NewAdvertiser api={api} onCreated={(id) => setView({ mode: 'detail', id })} /> : null}
        {view.mode === 'detail' ? <CustomerDetail customerId={view.id} /> : null}
        {view.mode === 'settings' ? <CustomerSettingsPage /> : null}
      </div>
    </CustomersProvider>
  );
}
