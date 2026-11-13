/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import BrandMark from '@/components/BrandMark';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export const ADA_TECHNOLOGY_URL = 'https://adatechnology.com.br';

/**
 * Rodape de copyright da Ada Technology com o Studio Boold, com o simbolo da
 * marca em cima — o mesmo da vitrine e do painel. Fica no fim
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
