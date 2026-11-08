/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A ficha de um pai: quem e', quanto usa e o que fez, em ordem. A API so'
 * devolve datas, contagens e o que ja' e' publico na comunidade.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Baby,
  CalendarCheck,
  CalendarPlus,
  Eye,
  Flag,
  Heart,
  LogIn,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { setUserBlocked } from './panel-actions';
import { dayKey, formatDate, formatDateTime, formatDayHeading, formatNumber, formatRelative, formatTime, formatUsd } from './panel-format';
import { PANEL_TEXT } from './panel-text';
import { Avatar, Badge, Card, CardHeader, EmptyState, ErrorText, Loading } from './panel-ui';
import { usePanelRequest } from './usePanelRequest';

const text = PANEL_TEXT.detail;

const EVENT_STYLE = {
  signup: { icon: UserPlus, tone: 'bg-blue-100 text-blue-700' },
  login: { icon: LogIn, tone: 'bg-zinc-950 text-zinc-400' },
  child: { icon: Baby, tone: 'bg-amber-100 text-amber-800' },
  activity: { icon: CalendarPlus, tone: 'bg-blue-50 text-blue-600' },
  activity_done: { icon: CalendarCheck, tone: 'bg-emerald-50 text-emerald-700' },
  post: { icon: Newspaper, tone: 'bg-blue-50 text-blue-600' },
  comment: { icon: MessageCircle, tone: 'bg-blue-50 text-blue-600' },
  chat: { icon: MessagesSquare, tone: 'bg-zinc-950 text-zinc-200' },
  ai: { icon: Sparkles, tone: 'bg-amber-50 text-amber-700' },
  insight: { icon: Star, tone: 'bg-amber-50 text-amber-700' },
  report_made: { icon: Flag, tone: 'bg-zinc-950 text-zinc-400' },
  report_received: { icon: ShieldAlert, tone: 'bg-red-50 text-red-600' },
  audit: { icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-700' },
};

/** O que aparece ao lado do rotulo: categoria, trecho publico, motivo ou recurso. */
function describeEvent(event) {
  const label = PANEL_TEXT.timeline[event.kind] ?? event.kind;
  switch (event.kind) {
    case 'chat':
      return { label, detail: event.count === 1 ? '1 mensagem' : `${event.count} mensagens` };
    case 'ai':
      return { label, detail: `${PANEL_TEXT.aiTasks[event.detail] ?? event.detail}${event.count > 1 ? ` · ${event.count}×` : ''}` };
    case 'report_made':
    case 'report_received':
      return { label, detail: PANEL_TEXT.reportReasons[event.detail] ?? event.detail };
    case 'audit':
      return { label: PANEL_TEXT.audit[event.detail] ?? event.detail, detail: null };
    case 'post':
    case 'comment':
      return { label, detail: event.detail, quote: true };
    default:
      return { label, detail: event.detail };
  }
}

function groupByDay(events) {
  const groups = [];
  for (const event of events) {
    const key = dayKey(event.at);
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, events: [event] });
  }
  return groups;
}

function MiniStat({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-white p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="text-lg font-bold text-zinc-100">{value}</p>
        {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function PanelUserDetail({ client, can, navigate, id }) {
  const { data, error, loading } = usePanelRequest(client, `/app-users/${encodeURIComponent(id)}`);
  const [blockedAt, setBlockedAt] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const back = (
    <button type="button" onClick={() => navigate('pais')} className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
      <ArrowLeft className="h-4 w-4" />
      {text.back}
    </button>
  );

  if (loading) return <>{back}<Loading /></>;
  if (error) {
    return (
      <>
        {back}
        <ErrorText error={error.status === 404 ? text.notFound : error} />
      </>
    );
  }

  const { profile, stats, timeline, teamViews, lastLoginAt, lastActivityAt } = data.data;
  const currentBlockedAt = blockedAt === undefined ? profile.blockedAt : blockedAt;

  async function toggleBlocked() {
    setSaving(true);
    setActionError('');
    try {
      const next = await setUserBlocked(client, profile, !currentBlockedAt);
      if (next !== undefined) setBlockedAt(next);
    } catch (failure) {
      setActionError(failure.status === 403 ? PANEL_TEXT.users.onlyAdmins : failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {back}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={profile.fullName ?? profile.email} className="h-14 w-14 text-xl" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-zinc-100">{profile.fullName ?? profile.email}</h1>
              <p className="truncate text-sm text-zinc-400">
                {profile.email}
                {profile.city ? ` · ${profile.city}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {currentBlockedAt ? (
                  <Badge tone="red">Bloqueado desde {formatDate(currentBlockedAt)}</Badge>
                ) : (
                  <Badge tone="green">{PANEL_TEXT.users.active}</Badge>
                )}
                <Badge tone={profile.onboardingCompleted ? 'neutral' : 'yellow'}>
                  Cadastro {profile.onboardingCompleted ? 'completo' : 'incompleto'}
                </Badge>
                {stats.reportsReceivedOpen > 0 ? (
                  <Badge tone="red">
                    <Flag className="h-3 w-3" />
                    {stats.reportsReceivedOpen} {stats.reportsReceivedOpen === 1 ? 'denúncia aberta' : 'denúncias abertas'}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          {can('app-users:block') ? (
            <Button variant={currentBlockedAt ? 'outline' : 'destructive'} size="sm" disabled={saving} onClick={toggleBlocked}>
              {saving ? PANEL_TEXT.users.saving : currentBlockedAt ? PANEL_TEXT.users.unblock : PANEL_TEXT.users.block}
            </Button>
          ) : null}
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-800 pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-400">{text.since}</dt>
            <dd className="font-medium text-zinc-100">{formatDate(profile.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">{text.lastLogin}</dt>
            <dd className="font-medium text-zinc-100" title={formatDateTime(lastLoginAt)}>
              {formatRelative(lastLoginAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">{text.lastActivity}</dt>
            <dd className="font-medium text-zinc-100" title={formatDateTime(lastActivityAt)}>
              {formatRelative(lastActivityAt)}
            </dd>
          </div>
        </dl>
        <ErrorText error={actionError} />
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={Baby} label="Filhos" value={stats.children} />
        <MiniStat icon={CalendarCheck} label="Atividades" value={stats.activities} hint={`${stats.activitiesCompleted} concluídas`} />
        <MiniStat icon={MessagesSquare} label="Mensagens ao mentor" value={formatNumber(stats.chatMessages)} />
        <MiniStat icon={LogIn} label="Logins" value={formatNumber(stats.logins)} />
        <MiniStat icon={Newspaper} label="Posts e comentários" value={stats.posts + stats.comments} hint={`${stats.posts} ${stats.posts === 1 ? 'post' : 'posts'} · ${stats.comments} ${stats.comments === 1 ? 'comentário' : 'comentários'}`} />
        <MiniStat icon={Heart} label="Curtidas dadas" value={stats.likesGiven} />
        <MiniStat
          icon={Flag}
          label="Denúncias"
          value={`${stats.reportsReceived} / ${stats.reportsMade}`}
          hint="recebidas / feitas"
        />
        <MiniStat
          icon={Sparkles}
          label="Custo de IA (30 dias)"
          value={formatUsd(stats.aiCost30MicroUsd)}
          hint={`${stats.aiCalls30} chamadas · total ${formatUsd(stats.aiCostMicroUsd)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader title={text.timeline} description={text.timelineHint} />
          {timeline.length === 0 ? <EmptyState title={text.timelineEmpty} /> : null}
          <div className="divide-y divide-zinc-800">
            {groupByDay(timeline).map((group) => (
              <section key={group.key} className="px-4 py-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{formatDayHeading(group.key)}</h3>
                <ol className="space-y-2.5">
                  {group.events.map((event, index) => {
                    const style = EVENT_STYLE[event.kind] ?? EVENT_STYLE.audit;
                    const Icon = style.icon;
                    const { label, detail, quote } = describeEvent(event);
                    return (
                      <li key={`${event.at}-${event.kind}-${index}`} className="flex gap-3">
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', style.tone)}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-200">
                            {label}
                            {detail && !quote ? <span className="text-zinc-400"> · {detail}</span> : null}
                          </p>
                          {detail && quote ? (
                            <p className="mt-0.5 line-clamp-2 border-l-2 border-zinc-800 pl-2 text-xs italic text-zinc-400">{detail}</p>
                          ) : null}
                        </div>
                        <time className="shrink-0 text-xs text-zinc-500" dateTime={event.at}>
                          {formatTime(event.at)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title={text.teamViews} />
            <ul className="space-y-2 p-4 text-sm">
              {teamViews.length === 0 ? <li className="text-xs text-zinc-400">{text.teamViewsEmpty}</li> : null}
              {teamViews.map((view, index) => (
                <li key={`${view.at}-${index}`} className="flex items-start gap-2">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-zinc-200">{view.actorEmail ?? 'acesso removido'}</span>
                    <span className="text-xs text-zinc-500">{formatDateTime(view.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="px-1 text-xs text-zinc-400">
            {PANEL_TEXT.users.privacy} {text.viewedNote}
          </p>
        </div>
      </div>
    </div>
  );
}
