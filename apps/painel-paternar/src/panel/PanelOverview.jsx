/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { Activity, CalendarCheck, DollarSign, Flag, Repeat, UserPlus, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatNumber, formatPercent, formatUsd, shortDay } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import { Card, CardHeader, ErrorText, Loading, MeterRow, PageHeader, StatCard } from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const ORANGE = '#F28800';
const NAVY = '#2F2F51';
const text = PANEL_TEXT.overview;

function ChartCard({ title, description, children }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="h-56 px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const axis = { fontSize: 11, stroke: '#76758F', tickLine: false, axisLine: false };

export default function PanelOverview({ client, navigate }) {
  const overview = usePanelRequest(client, '/overview');
  const engagement = usePanelRequest(client, '/engagement');

  if (overview.loading || engagement.loading) return <Loading />;
  if (overview.error) return <ErrorText error={overview.error} />;
  const totals = overview.data?.data ?? {};
  const usage = engagement.data?.data;

  return (
    <div className="space-y-6">
      <PageHeader title={PANEL_TEXT.tabs.overview} description={text.activeHint} />
      <ErrorText error={engagement.error} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Users} label={text.users} value={totals.users ?? 0} hint={text.new7(totals.usersLast7Days ?? 0)} onClick={() => navigate('pais')} />
        <StatCard icon={Activity} tone="green" label={text.active7} value={usage?.activeUsers7 ?? 0} hint={text.today(usage?.activeUsers1 ?? 0)} />
        <StatCard icon={CalendarCheck} tone="navy" label={text.active30} value={usage?.activeUsers30 ?? 0} hint={`${formatPercent(usage?.activeUsers30, totals.users)} dos pais`} />
        <StatCard
          icon={Repeat}
          tone="yellow"
          label={text.retention}
          value={formatPercent(usage?.retention.returned, usage?.retention.cohort)}
          hint={text.retentionHint(usage?.retention.returned ?? 0, usage?.retention.cohort ?? 0)}
        />
        <StatCard
          icon={Flag}
          tone={usage?.openReports ? 'red' : 'green'}
          label={text.openReports}
          value={usage?.openReports ?? 0}
          hint={usage?.openReports ? 'Clique para decidir' : 'Nada pendente'}
          onClick={() => navigate('denuncias')}
        />
        <StatCard
          icon={DollarSign}
          tone="orange"
          label={text.aiCost}
          value={formatUsd(usage?.aiCost30MicroUsd)}
          hint={text.aiCalls(formatNumber(usage?.aiCalls30))}
          onClick={() => navigate('ia')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={text.active}>
          <AreaChart data={usage?.activeByDay ?? []} margin={{ left: 0, right: 8, top: 4 }}>
            <defs>
              <linearGradient id="ativos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#E9E5DB" />
            <XAxis dataKey="day" tickFormatter={shortDay} {...axis} />
            <YAxis allowDecimals={false} width={28} {...axis} />
            <Tooltip labelFormatter={shortDay} formatter={(value) => [value, 'pais ativos']} />
            <Area type="monotone" dataKey="total" stroke={ORANGE} strokeWidth={2} fill="url(#ativos)" isAnimationActive={false} />
          </AreaChart>
        </ChartCard>
        <ChartCard title={text.signups}>
          <BarChart data={totals.signupsByDay ?? []} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} stroke="#E9E5DB" />
            <XAxis dataKey="day" tickFormatter={shortDay} {...axis} />
            <YAxis allowDecimals={false} width={28} {...axis} />
            <Tooltip labelFormatter={shortDay} formatter={(value) => [value, 'cadastros']} />
            <Bar dataKey="total" fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartCard>
      </div>

      {usage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={text.funnel} description={text.funnelHint} />
            <div className="space-y-3 p-4">
              {Object.entries(text.funnelSteps).map(([key, label]) => (
                <MeterRow
                  key={key}
                  label={label}
                  value={usage.funnel[key]}
                  max={usage.funnel.users}
                  suffix={key === 'users' ? undefined : formatPercent(usage.funnel[key], usage.funnel.users)}
                />
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title={text.usage} />
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-zinc-800">
              {Object.entries(text.usageItems).map(([key, label]) => (
                <div key={key} className="bg-white p-4">
                  <dt className="text-xs text-zinc-400">{label}</dt>
                  <dd className="text-xl font-bold text-zinc-100">{formatNumber(usage.last30[key])}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        <UserPlus className="h-3.5 w-3.5" />
        {text.onboarded}: {formatNumber(totals.usersOnboarded)} · {text.children}: {formatNumber(totals.children)} · {text.posts}:{' '}
        {formatNumber(totals.communityPosts)}
      </p>
    </div>
  );
}
