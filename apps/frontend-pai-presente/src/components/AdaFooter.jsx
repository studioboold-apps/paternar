/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export const ADA_TECHNOLOGY_URL = 'https://adatechnology.com.br';

/**
 * Rodape de copyright da Ada Technology, a empresa que faz o app. Fica no fim
 * de toda tela (login, abertura do cadastro, paginas do app e "nao existe").
 */
export default function AdaFooter({ className }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={cn('px-4 py-6 text-center text-xs text-muted-foreground', className)}>
      © {year}{' '}
      <a
        href={ADA_TECHNOLOGY_URL}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-foreground/80 underline-offset-2 hover:underline"
      >
        {t('common.copyright.company')}
      </a>
      {' · '}
      {t('common.copyright.rights')}
    </footer>
  );
}
