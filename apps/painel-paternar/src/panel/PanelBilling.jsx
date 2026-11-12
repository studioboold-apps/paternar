/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Assinaturas: o que a Hotmart avisou pelo webhook, do jeito que a API guardou.
 */

import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, CreditCard, RotateCcw, UserX, XCircle } from 'lucide-react';

import { Input } from '@/components/ui/input';

import { formatDate, formatDateTime, formatMoney } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorText,
  Loading,
  MeterRow,
  PageHeader,
  Pager,
  Segmented,
  StatCard,
  TABLE_CELL,
  TABLE_HEAD,
} from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const text = PANEL_TEXT.billing;
const PER_PAGE = 20;
const STATUS_TONES = { active: 'green', past_due: 'yellow', canceled: 'neutral', refunded: 'red', pending: 'orange' };
const STATUS_FILTERS = ['', 'active', 'past_due', 'canceled', 'refunded', 'pending'];

const planName = (code) => PANEL_TEXT.billingPlans[code] ?? code;

export default function PanelBilling({ client, navigate }) {
  const overview = usePanelRequest(client, '/billing/overview');
  const data = overview.data?.data;
  const byStatus = data?.byStatus ?? {};

  return (
    <div className="space-y-5">
      <PageHeader title={text.title} description={text.description} />
      <ErrorText error={overview.error} />
      {overview.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard icon={BadgeCheck} tone="green" label={text.active} value={byStatus.active ?? 0} />
            <StatCard icon={AlertTriangle} tone="yellow" label={text.pastDue} value={byStatus.past_due ?? 0} />
            <StatCard icon={XCircle} tone="navy" label={text.canceled} value={byStatus.canceled ?? 0} />
            <StatCard icon={RotateCcw} tone="red" label={text.refunded} value={byStatus.refunded ?? 0} />
            <StatCard
              icon={CreditCard}
              label={text.revenue}
              value={data.revenue30d.length ? data.revenue30d.map((row) => formatMoney(row.cents, row.currency)).join(' + ') : formatMoney(0)}
              hint={`${data.revenue30d.reduce((sum, row) => sum + row.payments, 0)} pagamentos`}
            />
            <StatCard icon={UserX} tone="orange" label={text.unlinked} value={data.unlinked} hint={text.unlinkedHint} />
          </div>
          {data.byPlan.length ? (
            <Card>
              <CardHeader title={text.byPlan} />
              <div className="space-y-3 p-4">
                {data.byPlan.map((row) => (
                  <MeterRow
                    key={row.planCode}
                    label={planName(row.planCode)}
                    value={row.count}
                    max={Math.max(...data.byPlan.map((entry) => entry.count))}
                  />
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
      <Subscribers client={client} navigate={navigate} />
      <Events client={client} />
    </div>
  );
}

function Subscribers({ client, navigate }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (status) params.set('status', status);
  if (search.trim()) params.set('search', search.trim());
  const { data, error, loading } = usePanelRequest(client, `/billing/subscriptions?${params}`);
  const rows = data?.data ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={text.subscribers}
        action={
          <Segmented
            label={text.status}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={STATUS_FILTERS.map((value) => ({ value, label: value ? PANEL_TEXT.billingStatus[value] : text.all }))}
          />
        }
      />
      <div className="border-b border-zinc-800 p-3">
        <Input
          value={search}
          placeholder={text.search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <ErrorText error={error} />
      {loading && !data ? <Loading /> : null}
      {data && rows.length === 0 ? (
        <EmptyState icon={CreditCard} title={text.empty}>
          {text.emptyHint}
        </EmptyState>
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950/60">
              <tr>
                <th className={TABLE_HEAD}>{text.who}</th>
                <th className={TABLE_HEAD}>{text.plan}</th>
                <th className={TABLE_HEAD}>{text.status}</th>
                <th className={TABLE_HEAD}>{text.until}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={row.user ? () => navigate('pais', row.user.id) : undefined}
                  className={row.user ? 'cursor-pointer border-t border-zinc-800 hover:bg-blue-50/40' : 'border-t border-zinc-800'}
                >
                  <td className={TABLE_CELL}>
                    <p className="truncate font-medium text-zinc-100">{row.user?.name ?? row.user?.email ?? row.customerEmail ?? '—'}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {row.user ? row.user.email : `${row.customerEmail ?? ''} · ${text.unlinked.toLowerCase()}`}
                    </p>
                  </td>
                  <td className={TABLE_CELL}>{planName(row.planCode)}</td>
                  <td className={TABLE_CELL}>
                    <Badge tone={STATUS_TONES[row.status]}>{PANEL_TEXT.billingStatus[row.status] ?? row.status}</Badge>
                  </td>
                  <td className={TABLE_CELL}>{formatDate(row.periodEndsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {data?.pagination ? (
        <div className="border-t border-zinc-800 px-4 py-3">
          <Pager page={page} perPage={PER_PAGE} total={data.pagination.total} onChange={setPage} />
        </div>
      ) : null}
    </Card>
  );
}

function Events({ client }) {
  const [page, setPage] = useState(1);
  const { data, error, loading } = usePanelRequest(client, `/billing/events?page=${page}&perPage=${PER_PAGE}`);
  const rows = data?.data ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader title={text.events} />
      <ErrorText error={error} />
      {loading && !data ? <Loading /> : null}
      {data && rows.length === 0 ? <EmptyState icon={CreditCard} title={text.emptyEvents} /> : null}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950/60">
              <tr>
                <th className={TABLE_HEAD}>{text.when}</th>
                <th className={TABLE_HEAD}>{text.what}</th>
                <th className={TABLE_HEAD}>{text.who}</th>
                <th className={`${TABLE_HEAD} text-right`}>{text.value}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800">
                  <td className={`${TABLE_CELL} whitespace-nowrap`}>{formatDateTime(row.occurredAt)}</td>
                  <td className={TABLE_CELL}>
                    <p>{PANEL_TEXT.billingEvents[row.type] ?? row.type}</p>
                    <p className="font-mono text-[11px] text-zinc-500">{row.providerEventType}</p>
                  </td>
                  <td className={`${TABLE_CELL} truncate`}>{row.customerEmail ?? '—'}</td>
                  <td className={`${TABLE_CELL} text-right`}>
                    {row.amountCents === null ? '—' : formatMoney(row.amountCents, row.currency ?? 'BRL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {data?.pagination ? (
        <div className="border-t border-zinc-800 px-4 py-3">
          <Pager page={page} perPage={PER_PAGE} total={data.pagination.total} onChange={setPage} />
        </div>
      ) : null}
    </Card>
  );
}
