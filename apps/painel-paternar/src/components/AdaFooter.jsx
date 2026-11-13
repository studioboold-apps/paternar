/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { BrandSymbol } from '@/components/PanelBrand';
import { PANEL_TEXT } from '@/panel/panel-text';

/**
 * Rodape de copyright da Ada Technology com o Studio Boold, com o simbolo da
 * marca em cima — o mesmo da vitrine e do app.
 */
export default function AdaFooter({ className = '' }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`px-4 py-6 text-center text-xs text-zinc-400 ${className}`}>
      <BrandSymbol className="mx-auto mb-2 h-6 w-6" />
      © {year}{' '}
      <a
        href="https://adatechnology.com.br"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-zinc-300 underline-offset-2 hover:underline"
      >
        {PANEL_TEXT.copyright.company}
      </a>
      {' & '}
      <span className="font-semibold text-zinc-300">{PANEL_TEXT.copyright.partner}</span>
      {' · '}
      {PANEL_TEXT.copyright.rights}
    </footer>
  );
}
