/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React, { useEffect, useState } from 'react';
import { ChevronRight, Search, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { setUserBlocked } from './panel-actions';
import { formatDate } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import { Avatar, Badge, Card, EmptyState, ErrorText, Loading, PageHeader, Pager, TABLE_CELL, TABLE_HEAD } from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const PER_PAGE = 20;
const SEARCH_DELAY_MS = 300;
const text = PANEL_TEXT.users;

export default function PanelAppUsers({ client, can, navigate }) {
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  /** O que a equipe mudou nesta tela, por cima da lista que veio da API. */
  const [blockedById, setBlockedById] = useState({});
  const [savingId, setSavingId] = useState('');
  const [actionError, setActionError] = useState('');
  const canBlock = can('app-users:block');

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

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const blockedAtOf = (user) => (user.id in blockedById ? blockedById[user.id] : user.blockedAt);

  async function toggleBlocked(event, user) {
    event.stopPropagation();
    setSavingId(user.id);
    setActionError('');
    try {
      const blockedAt = await setUserBlocked(client, user, !blockedAtOf(user));
      if (blockedAt !== undefined) setBlockedById((current) => ({ ...current, [user.id]: blockedAt }));
    } catch (failure) {
      setActionError(failure.status === 403 ? text.onlyAdmins : failure.message);
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={text.title} description={text.description} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          type="search"
          className="bg-white pl-9"
          placeholder={text.search}
          aria-label={text.search}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
      <ErrorText error={error} />
      <ErrorText error={actionError} />
      <Card className="overflow-hidden">
        {loading && rows.length === 0 ? <Loading /> : null}
        {!loading && rows.length === 0 ? <EmptyState icon={Users} title={text.empty} /> : null}
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950/60">
                <tr>
                  <th className={TABLE_HEAD}>{text.name}</th>
                  <th className={`${TABLE_HEAD} hidden md:table-cell`}>{text.city}</th>
                  <th className={`${TABLE_HEAD} hidden sm:table-cell`}>{text.children}</th>
                  <th className={TABLE_HEAD}>{text.status}</th>
                  <th className={`${TABLE_HEAD} hidden md:table-cell`}>{text.since}</th>
                  <th className={TABLE_HEAD}>
                    <span className="sr-only">{text.open}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const blocked = Boolean(blockedAtOf(user));
                  return (
                    <tr
                      key={user.id}
                      onClick={() => navigate('pais', user.id)}
                      className="cursor-pointer border-t border-zinc-800 transition-colors hover:bg-blue-50/40"
                    >
                      <td className={TABLE_CELL}>
                        <div className="flex items-center gap-3">
                          <Avatar name={user.fullName ?? user.email} className="h-8 w-8 text-sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-100">{user.fullName ?? '—'}</p>
                            <p className="truncate text-xs text-zinc-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${TABLE_CELL} hidden md:table-cell`}>{user.city ?? '—'}</td>
                      <td className={`${TABLE_CELL} hidden sm:table-cell`}>{user.childrenCount}</td>
                      <td className={TABLE_CELL}>
                        <div className="flex flex-wrap gap-1">
                          {blocked ? <Badge tone="red">{text.blocked}</Badge> : <Badge tone="green">{text.active}</Badge>}
                          {!user.onboardingCompleted ? <Badge tone="yellow">{text.incomplete}</Badge> : null}
                        </div>
                      </td>
                      <td className={`${TABLE_CELL} hidden md:table-cell`}>{formatDate(user.createdAt)}</td>
                      <td className={`${TABLE_CELL} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          {canBlock ? (
                            <Button
                              variant={blocked ? 'outline' : 'ghost'}
                              size="sm"
                              className={blocked ? '' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}
                              disabled={savingId === user.id}
                              onClick={(event) => toggleBlocked(event, user)}
                            >
                              {savingId === user.id ? text.saving : blocked ? text.unblock : text.block}
                            </Button>
                          ) : null}
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
      <Pager page={page} perPage={PER_PAGE} total={total} onChange={setPage} />
      <p className="text-xs text-zinc-400">{text.privacy}</p>
    </div>
  );
}
