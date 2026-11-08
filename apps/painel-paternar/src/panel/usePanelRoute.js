/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Endereco da tela no `#` da URL (`#/pais/<id>`): o link de uma ficha pode ser
 * colado no chat da equipe, e o voltar do navegador volta para a lista.
 */

import { useCallback, useEffect, useState } from 'react';

export function parseRoute(hash) {
  const [section = '', id = ''] = hash.replace(/^#\/?/, '').split('/');
  return { section, id: decodeURIComponent(id) };
}

export function routeHref(section, id) {
  return id ? `#/${section}/${encodeURIComponent(id)}` : `#/${section}`;
}

export function usePanelRoute(defaultSection) {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((section, id) => {
    window.location.hash = routeHref(section, id);
  }, []);

  return { section: route.section || defaultSection, id: route.id, navigate };
}
