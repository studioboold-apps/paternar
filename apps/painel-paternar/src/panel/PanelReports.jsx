/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Fila de denuncias da comunidade. Arquivar ou remover fecha todas as
 * denuncias abertas do mesmo conteudo; bloquear o autor usa a mesma rota da
 * lista de pais.
 */

import React, { useState } from 'react';
import { Archive, Ban, CheckCircle2, Flag, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { groupReports, setUserBlocked } from './panel-actions';
import { formatDateTime } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import { Badge, Card, EmptyState, ErrorText, Loading, PageHeader, Pager, Segmented } from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const PER_PAGE = 20;
const text = PANEL_TEXT.reports;
const REASON_TONE = { ofensivo: 'red', golpe: 'red', spam: 'yellow', inadequado: 'orange', outro: 'neutral' };

function ReportCard({ group, client, can, navigate, onChanged }) {
  const [report] = group.reports;
  const reasons = [...new Set(group.reports.map((entry) => entry.reason))];
  const [busy, setBusy] = useState('');
  const [failure, setFailure] = useState('');
  const [authorBlockedAt, setAuthorBlockedAt] = useState(report.author.blockedAt);
  const isOpen = report.status === 'open';
  const canModerate = can('community:moderate');

  async function run(kind, action) {
    setBusy(kind);
    setFailure('');
    try {
      await action();
    } catch (error) {
      setFailure(error.status === 403 ? text.readOnly : error.message);
    } finally {
      setBusy('');
    }
  }

  const resolve = (action) =>
    run(action, async () => {
      if (!window.confirm(action === 'remove' ? text.confirmRemove : text.confirmDismiss)) return;
      await client.requestJson('POST', `/reports/${encodeURIComponent(report.id)}/resolve`, { action });
      onChanged();
    });

  const block = () =>
    run('block', async () => {
      const next = await setUserBlocked(client, { id: report.author.id, fullName: report.author.name, email: report.author.email }, true);
      if (next !== undefined) setAuthorBlockedAt(next);
    });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        {reasons.map((reason) => (
          <Badge key={reason} tone={REASON_TONE[reason] ?? 'neutral'}>
            <Flag className="h-3 w-3" />
            {PANEL_TEXT.reportReasons[reason] ?? reason}
          </Badge>
        ))}
        <Badge>{report.targetType === 'comment' ? text.comment : text.post}</Badge>
        {Math.max(group.reports.length, isOpen ? report.openOnSameContent : 0) > 1 ? (
          <Badge tone="red">{text.sameContent(Math.max(group.reports.length, isOpen ? report.openOnSameContent : 0))}</Badge>
        ) : null}
        {!report.contentOnline ? <Badge>{text.offline}</Badge> : null}
        <span className="ml-auto text-xs text-zinc-500">{formatDateTime(report.createdAt)}</span>
      </div>

      <blockquote className="mt-3 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
        {report.contentSnapshot}
      </blockquote>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-zinc-400">{text.author}</p>
          <button type="button" onClick={() => navigate('pais', report.author.id)} className="text-left font-medium text-blue-700 hover:underline">
            {report.author.name ?? report.author.email}
          </button>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={report.author.reportsReceived > 1 ? 'red' : 'neutral'}>{text.authorReports(report.author.reportsReceived)}</Badge>
            {authorBlockedAt ? <Badge tone="red">{PANEL_TEXT.users.blocked}</Badge> : null}
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-400">{text.reporter}</p>
          <ul className="space-y-1.5">
            {group.reports.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => navigate('pais', entry.reporter.id)} className="text-left text-zinc-200 hover:underline">
                  {entry.reporter.name ?? entry.reporter.email}
                </button>
                <span className="text-xs text-zinc-500">
                  {' '}
                  · {PANEL_TEXT.reportReasons[entry.reason] ?? entry.reason} · {formatDateTime(entry.createdAt)}
                </span>
                {entry.details ? <p className="text-xs italic text-zinc-400">“{entry.details}”</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ErrorText error={failure} />

      {isOpen && canModerate ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
          {report.contentOnline ? (
            <Button size="sm" variant="destructive" disabled={busy !== ''} onClick={() => resolve('remove')}>
              <Trash2 />
              {text.remove}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => resolve('dismiss')}>
            <Archive />
            {text.dismiss}
          </Button>
          {can('app-users:block') && !authorBlockedAt ? (
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy !== ''} onClick={block}>
              <Ban />
              {text.blockAuthor}
            </Button>
          ) : null}
        </div>
      ) : null}
      {isOpen && !canModerate ? <p className="mt-3 text-xs text-zinc-400">{text.readOnly}</p> : null}
      {!isOpen ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          {text.resolvedBy(report.resolvedByEmail, formatDateTime(report.resolvedAt))}
        </p>
      ) : null}
    </Card>
  );
}

export default function PanelReports({ client, can, navigate }) {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const { data, error, loading } = usePanelRequest(client, `/reports?status=${status}&page=${page}&perPage=${PER_PAGE}&v=${version}`);
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const change = (next) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={text.title}
        description={text.description}
        actions={
          <Segmented
            label={text.title}
            value={status}
            onChange={change}
            options={[
              { value: 'open', label: text.open, count: status === 'open' ? total : 0 },
              { value: 'dismissed', label: text.dismissed },
              { value: 'removed', label: text.removed },
            ]}
          />
        }
      />
      <ErrorText error={error} />
      {loading && rows.length === 0 ? <Loading /> : null}
      {!loading && rows.length === 0 ? (
        <Card>
          <EmptyState icon={status === 'open' ? CheckCircle2 : Flag} title={status === 'open' ? text.emptyOpen : text.empty} />
        </Card>
      ) : null}
      <div className="space-y-3">
        {groupReports(rows).map((group) => (
          <ReportCard
            key={group.key}
            group={group}
            client={client}
            can={can}
            navigate={navigate}
            onChanged={() => setVersion((current) => current + 1)}
          />
        ))}
      </div>
      <Pager page={page} perPage={PER_PAGE} total={total} onChange={setPage} />
    </div>
  );
}
