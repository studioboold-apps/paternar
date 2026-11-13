/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Limites dos planos: a chave que liga tudo, os numeros do gratuito, o teto de
 * gasto com IA de quem assina e quanto esse gasto esta custando.
 */

import React, { useEffect, useState } from 'react';
import { Gauge, PiggyBank, Users, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { formatMoney, formatPercent, formatUsd } from './panel-format';
import { formToSettings, settingsToForm } from './panel-plan-limits';
import { PANEL_TEXT } from './panel-text';
import { Badge, Card, CardHeader, ErrorText, Loading, PageHeader, StatCard, TABLE_CELL, TABLE_HEAD } from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const text = PANEL_TEXT.planLimits;
const FIELDS = [
  ['freeChatMessagesPerWeek', 'free'],
  ['freeMaxChildren', 'free'],
  ['subscriberRevenueBrl', 'budget'],
  ['aiShareOfRevenuePct', 'budget'],
  ['usdBrlRate', 'budget'],
  ['individualCapUsd', 'budget'],
  ['warnAtPct', 'budget'],
];

export default function PanelPlanLimits({ client, can }) {
  const [version, setVersion] = useState(0);
  const settings = usePanelRequest(client, `/plan-limits?v=${version}`);
  const spend = usePanelRequest(client, `/plan-limits/spend?v=${version}`);
  const data = settings.data?.data;

  return (
    <div className="space-y-5">
      <PageHeader title={text.title} description={text.description} />
      <ErrorText error={settings.error ?? spend.error} />
      {settings.loading && !data ? <Loading /> : null}
      {data ? (
        <SettingsForm
          client={client}
          settings={data}
          editable={can('plans:admin')}
          onSaved={() => setVersion((value) => value + 1)}
        />
      ) : null}
      {spend.data?.data ? <Spend data={spend.data.data} /> : null}
    </div>
  );
}

function SettingsForm({ client, settings, editable, onSaved }) {
  const [form, setForm] = useState(() => settingsToForm(settings));
  const [state, setState] = useState({ saving: false, error: undefined, saved: false });
  useEffect(() => setForm(settingsToForm(settings)), [settings]);

  const payload = formToSettings(form);
  const change = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  async function save(next = payload) {
    if (!next) return;
    setState({ saving: true, error: undefined, saved: false });
    try {
      await client.requestJson('PUT', '/plan-limits', next);
      setState({ saving: false, error: undefined, saved: true });
      onSaved();
    } catch (error) {
      setState({ saving: false, error, saved: false });
    }
  }

  return (
    <Card>
      <CardHeader
        title={text.switchTitle}
        description={settings.enabled ? text.onHint : text.offHint}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={settings.enabled ? 'green' : 'neutral'}>{settings.enabled ? text.on : text.off}</Badge>
            {editable ? (
              <Button
                size="sm"
                variant={settings.enabled ? 'outline' : 'default'}
                disabled={state.saving || !payload}
                onClick={() => save({ ...payload, enabled: !settings.enabled })}
              >
                {settings.enabled ? text.turnOff : text.turnOn}
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {FIELDS.map(([name, group]) => (
          <label key={name} className="space-y-1 text-sm">
            <span className="block text-zinc-300">{text.fields[name]}</span>
            <Input value={form[name]} onChange={change(name)} disabled={!editable} inputMode="decimal" />
            <span className="block text-xs text-zinc-500">{text.hints[name] ?? text.groups[group]}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 p-4">
        {editable ? (
          <Button disabled={state.saving || !payload} onClick={() => save()}>
            {state.saving ? text.saving : text.save}
          </Button>
        ) : (
          <span className="text-xs text-zinc-500">{text.readOnly}</span>
        )}
        {!payload ? <span className="text-xs text-red-400">{text.invalid}</span> : null}
        {state.saved ? <span className="text-xs text-green-400">{text.saved}</span> : null}
        <ErrorText error={state.error} />
      </div>
    </Card>
  );
}

function Spend({ data }) {
  const usedPct = formatPercent(data.spentMicroUsd, data.budgetMicroUsd);
  const revenue = data.revenue30d.length
    ? data.revenue30d.map((row) => formatMoney(row.cents, row.currency)).join(' + ')
    : formatMoney(0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label={text.subscribers} value={data.subscribers} />
        <StatCard icon={Gauge} tone="navy" label={text.average} value={formatUsd(data.averageMicroUsd)} hint={text.averageHint} />
        <StatCard
          icon={Wallet}
          tone="yellow"
          label={text.total}
          value={formatUsd(data.spentMicroUsd)}
          hint={`${usedPct} ${text.ofBudget} ${formatUsd(data.budgetMicroUsd)}`}
        />
        <StatCard icon={PiggyBank} tone="green" label={text.revenue} value={revenue} hint={text.revenueHint} />
      </div>
      <Card>
        <CardHeader title={text.topTitle} description={`${text.topHint} ${formatUsd(data.individualCapMicroUsd)}.`} />
        {data.topSpenders.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">{text.topEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TABLE_HEAD}>{text.columns.parent}</th>
                  <th className={TABLE_HEAD}>{text.columns.calls}</th>
                  <th className={TABLE_HEAD}>{text.columns.cost}</th>
                  <th className={TABLE_HEAD}>{text.columns.ofCap}</th>
                </tr>
              </thead>
              <tbody>
                {data.topSpenders.map((row) => (
                  <tr key={row.id}>
                    <td className={TABLE_CELL}>
                      <span className="block text-zinc-200">{row.name || row.email}</span>
                      <span className="block text-xs text-zinc-500">{row.email}</span>
                    </td>
                    <td className={TABLE_CELL}>{row.calls}</td>
                    <td className={TABLE_CELL}>{formatUsd(row.costMicroUsd)}</td>
                    <td className={TABLE_CELL}>{formatPercent(row.costMicroUsd, data.individualCapMicroUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
