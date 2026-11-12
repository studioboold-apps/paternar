/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { formatDateTime } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import { Card, EmptyState, ErrorText, Loading, PageHeader, Pager, TABLE_CELL, TABLE_HEAD } from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const PER_PAGE = 30;
const text = PANEL_TEXT.team;

export default function PanelTeamAccess({ client, navigate }) {
  const [page, setPage] = useState(1);
  const { data, error, loading } = usePanelRequest(client, `/team-access?page=${page}&perPage=${PER_PAGE}`);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title={text.title} description={text.description} />
      <ErrorText error={error} />
      <Card className="overflow-hidden">
        {loading && rows.length === 0 ? <Loading /> : null}
        {!loading && rows.length === 0 && !error ? <EmptyState icon={ShieldCheck} title={text.empty} /> : null}
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950/60">
                <tr>
                  <th className={TABLE_HEAD}>{text.when}</th>
                  <th className={TABLE_HEAD}>{text.who}</th>
                  <th className={TABLE_HEAD}>{text.what}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.at}-${index}`} className="border-t border-zinc-800">
                    <td className={`${TABLE_CELL} whitespace-nowrap text-zinc-400`}>{formatDateTime(row.at)}</td>
                    <td className={TABLE_CELL}>{row.actorName ?? row.actorEmail ?? 'acesso removido'}</td>
                    <td className={TABLE_CELL}>
                      {PANEL_TEXT.audit[row.action] ?? row.action}{' '}
                      {row.action === 'panel_user_viewed' ? (
                        <button
                          type="button"
                          onClick={() => navigate('pais', row.targetId)}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {row.targetName ?? row.targetEmail ?? 'conta apagada'}
                        </button>
                      ) : (
                        <span className="font-medium">{row.targetName ?? row.targetEmail ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
      <Pager page={page} perPage={PER_PAGE} total={data?.pagination?.total ?? 0} onChange={setPage} />
    </div>
  );
}
