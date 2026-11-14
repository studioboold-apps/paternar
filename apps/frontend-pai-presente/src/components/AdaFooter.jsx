/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import BrandMark from '@/components/BrandMark';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export const ADA_TECHNOLOGY_URL = 'https://adatechnology.com.br';

/** Simbolo da Ada Technology (o triangulo, do site da Ada). Todo copyright da Ada leva o simbolo, colado no nome. */
export const ADA_ICON_SRC = '/ada-icon.png';

/**
 * Rodape de copyright da Ada Technology com o Studio Boold, com o simbolo da
 * marca em cima. O simbolo da Ada (o triangulo) fica colado no nome dela —
 * regra: todo copyright da Ada leva o simbolo. Igual na vitrine e no painel. Fica no fim
 * de toda tela (login, abertura do cadastro, paginas do app e "nao existe").
 */
export default function AdaFooter({ className }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={cn('px-4 py-6 text-center text-xs text-muted-foreground', className)}>
      <BrandMark className="mx-auto mb-2 h-6 w-6" />
      © {year}{' '}
      <a
        href={ADA_TECHNOLOGY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 align-bottom font-semibold text-foreground/80 underline-offset-2 hover:underline"
      >
        <img src={ADA_ICON_SRC} alt="" width="16" height="14" className="h-3.5 w-auto" />
        {t('common.copyright.company')}
      </a>
      {' & '}
      <span className="font-semibold text-foreground/80">
        {t('common.copyright.partner')}
      </span>
      {' · '}
      {t('common.copyright.rights')}
    </footer>
  );
}
