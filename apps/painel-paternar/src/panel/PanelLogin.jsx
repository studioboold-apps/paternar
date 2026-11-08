/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React, { useState } from 'react';

import AdaFooter from '@/components/AdaFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { PANEL_TEXT } from './panel-text';

export default function PanelLogin({ client }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    const ok = await client.signIn({ email, password }).catch(() => false);
    setBusy(false);
    if (!ok) setFailed(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{PANEL_TEXT.title}</h1>
          <p className="text-sm text-zinc-400">{PANEL_TEXT.subtitle}</p>
        </div>
        <label className="block space-y-1 text-sm text-zinc-300">
          <span>{PANEL_TEXT.email}</span>
          <Input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm text-zinc-300">
          <span>{PANEL_TEXT.password}</span>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {failed ? <p className="text-sm text-red-600">{PANEL_TEXT.signInFailed}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? PANEL_TEXT.signingIn : PANEL_TEXT.signIn}
        </Button>
      </form>
      <AdaFooter className="absolute inset-x-0 bottom-0" />
    </div>
  );
}
