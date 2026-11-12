/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Enviar teste" no cabecalho do editor de modelos.
 *
 * Por padrao vai "para mim" (a conta do app com o e-mail de quem esta logado).
 * O admin pode trocar o destino por um pai buscado por nome ou e-mail; o rotulo
 * do botao sempre diz para quem vai, porque "Enviar", numa tela de modelo,
 * sugere disparar para todos os pais.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  describeTemplateTestError,
  describeTemplateTestResult,
  searchTestRecipients,
  sendTemplateTest,
} from './panel-template-test';

/** O aviso some sozinho: mensagem fixa vira parte do layout e para de ser lida. */
const FEEDBACK_MS = 8000;
const SEARCH_DEBOUNCE_MS = 300;

function RecipientPicker({ client, recipient, onChange }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let alive = true;
    const handle = window.setTimeout(() => {
      searchTestRecipients(client, search)
        .then((found) => alive && setOptions(found))
        .catch(() => alive && setOptions([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [client, search]);

  if (recipient) {
    return (
      <span className="inline-flex max-w-[16rem] items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200">
        <span className="truncate">Para: {recipient.label}</span>
        <button type="button" aria-label="Voltar a enviar para mim" onClick={() => onChange(undefined)}>
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Enviar para outro pai…"
        aria-label="Buscar pai por nome ou e-mail para receber o teste"
        className="w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
      />
      {options.length > 0 ? (
        <ul className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 text-xs shadow-lg">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="block w-full truncate px-3 py-2 text-left text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  onChange(option);
                  setSearch('');
                  setOptions([]);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}

export default function PanelTemplateTestButton({ client, templateKey, canChooseRecipient = false }) {
  const [state, setState] = useState({ status: 'idle', text: '' });
  const [recipient, setRecipient] = useState(undefined);
  const timer = useRef(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function finish(next) {
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState({ status: 'idle', text: '' }), FEEDBACK_MS);
  }

  async function handleClick() {
    setState({ status: 'sending', text: '' });
    try {
      const result = await sendTemplateTest(client, templateKey, recipient?.id);
      const view = describeTemplateTestResult(result, recipient?.label);
      finish({ status: view.ok ? 'sent' : 'failed', text: view.text });
    } catch (error) {
      finish({ status: 'failed', text: describeTemplateTestError(error) });
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {canChooseRecipient ? <RecipientPicker client={client} recipient={recipient} onChange={setRecipient} /> : null}
      <Button type="button" size="sm" disabled={state.status === 'sending'} onClick={handleClick}>
        <Send aria-hidden="true" className="h-4 w-4" />
        {state.status === 'sending' ? 'Enviando…' : recipient ? 'Enviar teste para este pai' : 'Enviar teste para mim'}
      </Button>
      {state.text ? (
        <span role="status" className={state.status === 'sent' ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>
          {state.text}
        </span>
      ) : null}
    </span>
  );
}
