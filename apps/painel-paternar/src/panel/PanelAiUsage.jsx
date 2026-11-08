/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React, { useState } from 'react';
import { Coins, DollarSign, MessagesSquare, Sparkles, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatNumber, formatUsd, shortDay } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorText,
  Loading,
  MeterRow,
  PageHeader,
  Segmented,
  StatCard,
  TABLE_CELL,
  TABLE_HEAD,
} from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const text = PANEL_TEXT.ai;
const PERIODS = [7, 30, 90];
const axis = { fontSize: 11, stroke: '#76758F', tickLine: false, axisLine: false };

export default function PanelAiUsage({ client, navigate }) {
  const [days, setDays] = useState(30);
  const { data, error, loading } = usePanelRequest(client, `/ai-usage?days=${days}`);
  const usage = data?.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={text.title}
        description={text.description}
        actions={
          <Segmented
            label={text.title}
            value={days}
            onChange={setDays}
            options={PERIODS.map((value) => ({ value, label: text.days(value) }))}
          />
        }
      />
      <ErrorText error={error} />
      {loading && !usage ? <Loading /> : null}
      {usage ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard icon={DollarSign} label={text.cost} value={formatUsd(usage.totals.costMicroUsd)} hint={text.days(days)} />
            <StatCard icon={Coins} tone="yellow" label={text.month} value={formatUsd(usage.monthToDateMicroUsd)} />
            <StatCard icon={MessagesSquare} tone="navy" label={text.calls} value={usage.totals.calls} />
            <StatCard icon={Users} tone="green" label={text.users} value={usage.totals.users} />
            <StatCard
              icon={Sparkles}
              tone="orange"
              label={text.perUser}
              value={usage.totals.users ? formatUsd(Math.round(usage.totals.costMicroUsd / usage.totals.users)) : '—'}
            />
            <StatCard
              icon={Sparkles}
              tone="navy"
              label={text.tokens}
              value={`${formatNumber(usage.totals.inputTokens + usage.totals.cacheReadTokens)} / ${formatNumber(usage.totals.outputTokens)}`}
              hint={`${formatNumber(usage.totals.cacheReadTokens)} lidos do cache · ${formatNumber(usage.totals.webSearches)} buscas na web`}
            />
          </div>

          {usage.totals.calls === 0 ? (
            <Card>
              <EmptyState icon={Sparkles} title={text.empty}>
                {text.note}
              </EmptyState>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader title={text.byDay} />
                <div className="h-60 px-2 py-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={usage.byDay.map((row) => ({ ...row, usd: row.costMicroUsd / 1_000_000 }))}
                      margin={{ left: 8, right: 8, top: 4 }}
                    >
                      <CartesianGrid vertical={false} stroke="#E9E5DB" />
                      <XAxis dataKey="day" tickFormatter={shortDay} {...axis} />
                      <YAxis width={48} tickFormatter={(value) => `$${value}`} {...axis} />
                      <Tooltip
                        labelFormatter={shortDay}
                        formatter={(_value, _name, item) => [
                          `${formatUsd(item.payload.costMicroUsd)} · ${item.payload.calls} chamadas`,
                          'custo',
                        ]}
                      />
                      <Bar dataKey="usd" fill="#F28800" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title={text.byTask} />
                  <div className="space-y-3 p-4">
                    {usage.byTask.map((row) => (
                      <MeterRow
                        key={row.task}
                        label={PANEL_TEXT.aiTasks[row.task] ?? row.task}
                        value={row.calls}
                        max={Math.max(...usage.byTask.map((entry) => entry.calls))}
                        suffix={`chamadas · ${formatUsd(row.costMicroUsd)}`}
                      />
                    ))}
                  </div>
                  <div className="border-t border-zinc-800 px-4 py-3">
                    <p className="mb-1 text-xs font-semibold text-zinc-400">{text.byModel}</p>
                    {usage.byModel.map((row) => (
                      <p key={row.model} className="flex justify-between text-sm text-zinc-300">
                        <span className="font-mono text-xs">{row.model}</span>
                        <span>
                          {formatNumber(row.calls)} · {formatUsd(row.costMicroUsd)}
                        </span>
                      </p>
                    ))}
                  </div>
                </Card>
                <Card className="overflow-hidden">
                  <CardHeader title={text.topUsers} />
                  <table className="w-full">
                    <thead className="bg-zinc-950/60">
                      <tr>
                        <th className={TABLE_HEAD}>Pai</th>
                        <th className={`${TABLE_HEAD} text-right`}>{text.calls}</th>
                        <th className={`${TABLE_HEAD} text-right`}>Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.topUsers.map((user) => (
                        <tr
                          key={user.id}
                          onClick={() => navigate('pais', user.id)}
                          className="cursor-pointer border-t border-zinc-800 hover:bg-blue-50/40"
                        >
                          <td className={TABLE_CELL}>
                            <p className="truncate font-medium text-zinc-100">{user.name ?? user.email}</p>
                            {user.name ? <p className="truncate text-xs text-zinc-400">{user.email}</p> : null}
                          </td>
                          <td className={`${TABLE_CELL} text-right`}>{formatNumber(user.calls)}</td>
                          <td className={`${TABLE_CELL} text-right`}>{formatUsd(user.costMicroUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
              <p className="text-xs text-zinc-400">{text.note}</p>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
