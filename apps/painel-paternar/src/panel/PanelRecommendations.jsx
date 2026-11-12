/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * A administracao inteira vem do `recommendations-ui`; daqui sai so o cliente
 * com a sessao da equipe e a lista de anunciantes para o seletor.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { RecommendationAdmin, RecommendationsProvider } from '@adatechnology/recommendations-ui';

import { createPanelRecommendationsApi, listSponsorOptions } from './panel-apis';
import { PANEL_TEXT } from './panel-text';
import { PageHeader } from './panel-ui';

export default function PanelRecommendations({ client }) {
  const api = useMemo(() => createPanelRecommendationsApi(client), [client]);
  const [sponsors, setSponsors] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    listSponsorOptions(client)
      .then((options) => !cancelled && setSponsors(options))
      // Sem a lista, a ficha pede o id do anunciante: pior, mas nao trava.
      .catch(() => !cancelled && setSponsors(undefined));
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <RecommendationsProvider api={api}>
      <PageHeader title={PANEL_TEXT.tabs.recommendations} description={PANEL_TEXT.recommendations.description} />
      <RecommendationAdmin sponsors={sponsors} />
    </RecommendationsProvider>
  );
}
