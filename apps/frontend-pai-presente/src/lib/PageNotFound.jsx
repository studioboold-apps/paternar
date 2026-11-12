/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { Home } from 'lucide-react';

import AdaFooter from '@/components/AdaFooter';
import BrandMark from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

/**
 * Pagina que nao existe. Era a tela generica da Base44, em ingles e cinza, com
 * um aviso de "admin" que mandava pedir a pagina para a IA. Agora fala a lingua
 * do app e leva para o Inicio.
 */
export default function PageNotFound() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center">
        <BrandMark motion="loop" className="mx-auto h-20 w-20" />
        <h1 className="mt-8 text-2xl font-bold text-foreground">{t('common.notFound.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('common.notFound.body')}</p>
        <Button
          onClick={() => window.location.assign('/')}
          className="mt-8 h-12 px-6 bg-gradient-to-r from-blue-500 to-amber-500 hover:from-blue-600 hover:to-amber-600 text-white"
        >
          <Home aria-hidden="true" className="w-4 h-4 mr-2" />
          {t('common.notFound.home')}
        </Button>
      </div>
      <AdaFooter className="absolute bottom-0 inset-x-0" />
    </div>
  );
}
