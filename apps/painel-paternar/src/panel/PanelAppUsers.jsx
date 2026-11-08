/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { PANEL_TEXT } from './panel-text';
import { usePanelRequest } from './usePanelRequest';

const PER_PAGE = 20;
const SEARCH_DELAY_MS = 300;
const CELL = 'px-3 py-2 text-sm text-zinc-200';
const HEADER = 'px-3 py-2 text-left text-xs font-medium uppercase text-zinc-400';

export default function PanelAppUsers({ client }) {
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(typed.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (search) params.set('search', search);
  const { data, error, loading } = usePanelRequest(client, `/app-users?${params.toString()}`);
  /** O que a equipe mudou nesta tela, por cima da lista que veio da API. */
  const [blockedById, setBlockedById] = useState({});
  const [savingId, setSavingId] = useState('');
  const [actionError, setActionError] = useState('');

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const text = PANEL_TEXT.users;

  const blockedAtOf = (user) => (user.id in blockedById ? blockedById[user.id] : user.blockedAt);

  async function toggleBlocked(user) {
    const willBlock = !blockedAtOf(user);
    const name = user.fullName || user.email;
    if (!window.confirm(willBlock ? text.confirmBlock(name) : text.confirmUnblock(name))) return;
    setSavingId(user.id);
    setActionError('');
    try {
      const result = await client.requestJson('PUT', `/app-users/${encodeURIComponent(user.id)}/blocked`, { blocked: willBlock });
      setBlockedById((current) => ({ ...current, [user.id]: result?.data?.blockedAt ?? null }));
    } catch (failure) {
      setActionError(failure.status === 403 ? text.onlyAdmins : failure.message);
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="space-y-4">
      <Input type="search" placeholder={text.search} aria-label={text.search} value={typed} onChange={(event) => setTyped(event.target.value)} />
      <p className="text-xs text-zinc-400">{text.privacy}</p>
      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className={HEADER}>{text.name}</th>
              <th className={HEADER}>{text.email}</th>
              <th className={HEADER}>{text.city}</th>
              <th className={HEADER}>{text.children}</th>
              <th className={HEADER}>{text.onboarding}</th>
              <th className={HEADER}>{text.since}</th>
              <th className={HEADER}>{text.status}</th>
              <th className={HEADER} />
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td className={CELL} colSpan={8}>
                  {text.empty}
                </td>
              </tr>
            ) : null}
            {rows.map((user) => (
              <tr key={user.id} className="border-t border-zinc-800">
                <td className={CELL}>{user.fullName ?? '-'}</td>
                <td className={CELL}>{user.email}</td>
                <td className={CELL}>{user.city ?? '-'}</td>
                <td className={CELL}>{user.childrenCount}</td>
                <td className={CELL}>{user.onboardingCompleted ? text.complete : text.incomplete}</td>
                <td className={CELL}>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className={CELL}>
                  {blockedAtOf(user) ? <span className="font-medium text-red-600">{text.blocked}</span> : text.active}
                </td>
                <td className={CELL}>
                  <Button
                    variant={blockedAtOf(user) ? 'outline' : 'destructive'}
                    size="sm"
                    disabled={savingId === user.id}
                    onClick={() => toggleBlocked(user)}
                  >
                    {savingId === user.id ? text.saving : blockedAtOf(user) ? text.unblock : text.block}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          {total.toLocaleString('pt-BR')} · {page}/{lastPage}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {text.previous}
          </Button>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
            {text.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
