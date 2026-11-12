/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useEffect, useState } from 'react';

/** GET simples no painel, recarregado quando o caminho muda. */
export function usePanelRequest(client, path) {
  const [state, setState] = useState({ data: undefined, error: undefined, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    client
      .requestJson('GET', path)
      .then((data) => !cancelled && setState({ data, error: undefined, loading: false }))
      .catch((error) => !cancelled && setState({ data: undefined, error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [client, path]);

  return state;
}
