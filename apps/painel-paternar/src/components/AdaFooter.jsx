/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { BrandSymbol } from '@/components/PanelBrand';
import { PANEL_TEXT } from '@/panel/panel-text';

/**
 * Rodape de copyright da Ada Technology com o Studio Boold. Em cima vem o logo
 * da Ada (regra: todo copyright da Ada leva o logo) ao lado do simbolo da
 * marca, como na vitrine e no app.
 */
export default function AdaFooter({ className = '' }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`px-4 py-6 text-center text-xs text-zinc-400 ${className}`}>
      <div className="mx-auto mb-2 flex w-fit items-center gap-3">
        <a href="https://adatechnology.com.br" target="_blank" rel="noreferrer" aria-label="Ada Technology">
          <img src="/ada-logo.png" alt="Ada Technology" width="32" height="35" className="h-10 w-auto rounded-md bg-white p-1" />
        </a>
        <BrandSymbol className="h-6 w-6" />
      </div>
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
