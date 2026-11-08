/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A area da equipe, num app proprio (`painel.paternar.com.br`): o pai nunca
 * baixa este codigo. A sessao aqui e' a da equipe, independente da sessao de
 * pai do app.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Flag, LayoutDashboard, LogOut, ShieldCheck, Sparkles, Star, Store, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

import { createPanelClient } from './panel-client';
import { PANEL_TEXT } from './panel-text';
import { Loading } from './panel-ui';
import PanelAdvertisers from './PanelAdvertisers';
import PanelAiUsage from './PanelAiUsage';
import PanelAppUsers from './PanelAppUsers';
import PanelLogin from './PanelLogin';
import PanelOverview from './PanelOverview';
import PanelRecommendations from './PanelRecommendations';
import PanelReports from './PanelReports';
import PanelTeamAccess from './PanelTeamAccess';
import PanelUserDetail from './PanelUserDetail';
import { usePanelRequest } from './usePanelRequest';
import { usePanelRoute } from './usePanelRoute';

export const PANEL_SCOPE = Object.freeze({
  BLOCK: 'app-users:block',
  MODERATE: 'community:moderate',
  ADMIN: 'user:admin',
});

/** `section` e' o pedaco da URL (`#/pais`); `key` e' o rotulo em `PANEL_TEXT.tabs`. */
const SECTIONS = [
  { section: 'visao-geral', key: 'overview', icon: LayoutDashboard, Component: PanelOverview },
  { section: 'pais', key: 'users', icon: Users, Component: PanelAppUsers, Detail: PanelUserDetail },
  { section: 'denuncias', key: 'reports', icon: Flag, Component: PanelReports },
  { section: 'ia', key: 'ai', icon: Sparkles, Component: PanelAiUsage },
  { section: 'anunciantes', key: 'advertisers', icon: Store, Component: PanelAdvertisers },
  { section: 'recomendacoes', key: 'recommendations', icon: Star, Component: PanelRecommendations },
  { section: 'equipe', key: 'team', icon: ShieldCheck, Component: PanelTeamAccess, scope: PANEL_SCOPE.ADMIN },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export default function PanelApp() {
  const client = useMemo(() => createPanelClient({ baseUrl: API_BASE_URL }), []);
  const [signedIn, setSignedIn] = useState(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => client.subscribe(setSignedIn), [client]);
  useEffect(() => {
    client.restore().finally(() => setRestoring(false));
  }, [client]);

  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loading />
      </div>
    );
  }
  if (!signedIn) return <PanelLogin client={client} />;
  return <PanelShell client={client} />;
}

function PanelShell({ client }) {
  const route = usePanelRoute(SECTIONS[0].section);
  const me = usePanelRequest(client, '/me');
  const scopes = me.data?.data?.scopes ?? [];
  const can = (scope) => scopes.includes(scope);
  const openReports = usePanelRequest(client, '/reports?status=open&perPage=1').data?.pagination?.total ?? 0;

  const visible = SECTIONS.filter((entry) => !entry.scope || can(entry.scope));
  const current = visible.find((entry) => entry.section === route.section) ?? visible[0];
  const View = route.id && current.Detail ? current.Detail : current.Component;
  const session = { client, can, navigate: route.navigate, id: route.id };

  const nav = visible.map((entry) => {
    const Icon = entry.icon;
    const active = entry === current;
    const badge = entry.key === 'reports' && openReports > 0 ? openReports : 0;
    return (
      <a
        key={entry.section}
        href={`#/${entry.section}`}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          active ? 'bg-blue-50 text-blue-700' : 'text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200',
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="whitespace-nowrap">{PANEL_TEXT.tabs[entry.key]}</span>
        {badge ? (
          <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white">{badge}</span>
        ) : null}
      </a>
    );
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:flex">
      <aside className="sticky top-0 z-10 border-b border-zinc-800 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:py-5">
          <Brand />
          <button
            type="button"
            onClick={() => client.signOut()}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 lg:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
            {PANEL_TEXT.signOut}
          </button>
        </div>
        <nav aria-label={PANEL_TEXT.title} className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {nav}
        </nav>
        <button
          type="button"
          onClick={() => client.signOut()}
          className="absolute bottom-4 left-3 right-3 hidden items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200 lg:flex"
        >
          <LogOut className="h-4 w-4" />
          {PANEL_TEXT.signOut}
        </button>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:ml-60 lg:px-8 lg:py-8">
        <View key={`${current.section}/${route.id}`} {...session} />
      </main>
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.png" alt="" className="h-8 w-8 rounded-lg" />
      <div className="leading-tight">
        <p className="text-sm font-bold text-zinc-100">{PANEL_TEXT.title}</p>
        <p className="text-[11px] text-zinc-400">{PANEL_TEXT.subtitle}</p>
      </div>
    </div>
  );
}
