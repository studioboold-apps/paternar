/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Enviar teste para mim" no cabecalho do editor de modelos.
 *
 * O rotulo diz "para mim" de proposito: "Enviar", numa tela de modelo, sugere
 * disparar para todos os pais, e essa duvida trava a mao de quem opera.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { describeTemplateTestError, describeTemplateTestResult, sendTemplateTest } from './panel-template-test';

/** O aviso some sozinho: mensagem fixa vira parte do layout e para de ser lida. */
const FEEDBACK_MS = 8000;

export default function PanelTemplateTestButton({ client, templateKey }) {
  const [state, setState] = useState({ status: 'idle', text: '' });
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
      const view = describeTemplateTestResult(await sendTemplateTest(client, templateKey));
      finish({ status: view.ok ? 'sent' : 'failed', text: view.text });
    } catch (error) {
      finish({ status: 'failed', text: describeTemplateTestError(error) });
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" size="sm" disabled={state.status === 'sending'} onClick={handleClick}>
        <Send aria-hidden="true" className="h-4 w-4" />
        {state.status === 'sending' ? 'Enviando…' : 'Enviar teste para mim'}
      </Button>
      {state.text ? (
        <span role="status" className={state.status === 'sent' ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>
          {state.text}
        </span>
      ) : null}
    </span>
  );
}
