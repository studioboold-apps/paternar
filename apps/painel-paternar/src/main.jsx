/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * App proprio, separado do app dos pais (servico `painel` no Railway, em
 * `painel.paternar.com.br`): o deploy de um nao mexe no outro, e o pai nunca
 * baixa codigo da equipe.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/nunito';

import PanelApp from '@/panel/PanelApp';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PanelApp />
  </React.StrictMode>,
);
