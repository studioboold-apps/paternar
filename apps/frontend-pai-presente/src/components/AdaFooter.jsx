/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import BrandMark from '@/components/BrandMark';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export const ADA_TECHNOLOGY_URL = 'https://adatechnology.com.br';

/** Logo da Ada Technology (do site adatechnology.com.br). Todo copyright da Ada leva o logo. */
export const ADA_LOGO_SRC = '/ada-logo.png';

/**
 * Rodape de copyright da Ada Technology com o Studio Boold. Em cima vem o logo
 * da Ada (regra: todo copyright da Ada leva o logo) ao lado do simbolo da
 * marca, como na vitrine e no painel. Fica no fim
 * de toda tela (login, abertura do cadastro, paginas do app e "nao existe").
 */
export default function AdaFooter({ className }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={cn('px-4 py-6 text-center text-xs text-muted-foreground', className)}>
      <div className="mx-auto mb-2 flex w-fit items-center gap-3">
        <a href={ADA_TECHNOLOGY_URL} target="_blank" rel="noreferrer" aria-label="Ada Technology">
          <img src={ADA_LOGO_SRC} alt="Ada Technology" width="32" height="35" className="h-10 w-auto rounded-md bg-white p-1" />
        </a>
        <BrandMark className="h-6 w-6" />
      </div>
      © {year}{' '}
      <a
        href={ADA_TECHNOLOGY_URL}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-foreground/80 underline-offset-2 hover:underline"
      >
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
