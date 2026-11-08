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

import AdaFooter from '@/components/AdaFooter';
import { Button } from '@/components/ui/button';

import { createPanelClient } from './panel-client';
import { PANEL_TEXT } from './panel-text';
import PanelAdvertisers from './PanelAdvertisers';
import PanelAppUsers from './PanelAppUsers';
import PanelLogin from './PanelLogin';
import PanelOverview from './PanelOverview';
import PanelRecommendations from './PanelRecommendations';

const TABS = [
  { key: 'overview', Component: PanelOverview },
  { key: 'users', Component: PanelAppUsers },
  { key: 'advertisers', Component: PanelAdvertisers },
  { key: 'recommendations', Component: PanelRecommendations },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export default function PanelApp() {
  const client = useMemo(() => createPanelClient({ baseUrl: API_BASE_URL }), []);
  const [signedIn, setSignedIn] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [tab, setTab] = useState(TABS[0].key);

  useEffect(() => client.subscribe(setSignedIn), [client]);
  useEffect(() => {
    client.restore().finally(() => setRestoring(false));
  }, [client]);

  if (restoring) {
    return <p className="p-6 text-sm text-zinc-400">{PANEL_TEXT.loading}</p>;
  }
  if (!signedIn) return <PanelLogin client={client} />;

  const Current = TABS.find((entry) => entry.key === tab)?.Component ?? PanelOverview;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">{PANEL_TEXT.title}</h1>
            <p className="text-xs text-zinc-400">{PANEL_TEXT.subtitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => client.signOut()}>
            {PANEL_TEXT.signOut}
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label={PANEL_TEXT.title}>
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              aria-current={entry.key === tab ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                entry.key === tab ? 'border-brand-orange text-zinc-100' : 'border-transparent text-zinc-400'
              }`}
            >
              {PANEL_TEXT.tabs[entry.key]}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Current client={client} />
      </main>
      <AdaFooter />
    </div>
  );
}
