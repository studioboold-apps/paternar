/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlanStatus } from '@/lib/use-plan';

import { api } from '@/api/client';
import { describeApiFailure } from '@/lib/api-error-message';
import { useTranslation } from '@/lib/i18n';
import { withStableIds } from '@/lib/insight-id';

/** A API ja devolve o feed do mais novo para o mais antigo. */
const FEED_PAGE_SIZE = 50;

export const COMMUNITY_TABS = Object.freeze({ FEED: 'feed', INSIGHTS: 'insights' });

/**
 * A decisao da Comunidade mora aqui (`web.md` §4): duas abas, quatro chamadas e
 * a nota otimista sao regra, e regra fora do JSX pode ser lida sem montar tela.
 */
export function useComunidade() {
  /** O idioma entra na chave: trocar de lingua pede insight novo, nao o guardado. */
  const { locale } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(COMMUNITY_TABS.FEED);
  const [activeCategory, setActiveCategory] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.entities.Child.list(),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api.entities.CommunityPost.list(FEED_PAGE_SIZE),
  });

  const { data: savedRatings = [] } = useQuery({
    queryKey: ['insightRatings'],
    queryFn: () => api.entities.InsightRating.list(),
  });

  /**
   * Pedir insight e' chamada de API, entao e' query — nao estado de tela
   * alimentado por efeito (`web.md` §5). O efeito antigo so disparava com a
   * lista vazia, o que travava a aba depois de uma falha: a lista continuava
   * vazia e a condicao continuava verdadeira, sem nunca tentar de novo.
   *
   * O prompt saiu do navegador: ele montava a pergunta com a orientacao
   * religiosa e politica do pai, e dado sensivel nao trafega na aba de rede
   * (`security.md` §1). Agora a API monta e a tela so pede o resultado.
   *
   * A identidade vem do TEXTO (`insight-id`, o mesmo modulo da Home), nunca do
   * relogio: ela e' a chave da nota em `PUT /v1/insight-ratings/:id`, e id novo
   * a cada geracao — ou id de outra receita em cada tela — faz a estrela do pai
   * nunca reaparecer.
   *
   * `staleTime: Infinity` porque cada refeitura custa uma chamada de IA — quem
   * pede texto novo e' o botao de atualizar, deliberadamente.
   */
  const insightsQuery = useQuery({
    queryKey: ['insights', activeCategory, locale],
    queryFn: async () => withStableIds(await api.ai.insights(activeCategory ?? undefined)),
    enabled: activeTab === COMMUNITY_TABS.INSIGHTS && children.length > 0 && user !== undefined,
    staleTime: Infinity,
  });

  const insights = insightsQuery.data ?? [];

  /**
   * Sem chave, `POST /v1/insights` responde 503 `AI_NOT_CONFIGURED`. A frase
   * morria escrita no log do navegador: o pai via o carregando girar, parar, e
   * a lista vazia — que e' exatamente o que ele veria se nao houvesse insight
   * nenhum. Duas situacoes diferentes, uma tela so.
   */
  const plan = usePlanStatus();
  const insightsFailure = insightsQuery.isError ? describeApiFailure(insightsQuery.error) : null;

  const rateMutation = useMutation({
    mutationFn: ({ insightId, rating, category, title }) =>
      api.entities.InsightRating.rate({
        insight_id: insightId,
        category,
        rating,
        insight_title: title,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insightRatings'] }),
  });

  /**
   * O mapa de notas e' DERIVADO do que o servidor ja trouxe (`react.md`: nunca
   * usar efeito para transformar dado). A copia em estado divergia — reavaliar
   * mudava o mapa local e a lista salva ficava com a nota antiga ate alguem
   * recarregar a pagina.
   *
   * A estrela que acende no clique sai da propria escrita em curso, e por isso
   * nao precisa de desfazer: falhando, a tela volta sozinha ao que o servidor
   * tem.
   */
  const savedRatingsMap = Object.fromEntries(savedRatings.map(({ insight_id: insightId, rating }) => [insightId, rating]));
  const pendingRating = rateMutation.isPending ? rateMutation.variables : undefined;
  const ratings = pendingRating === undefined
    ? savedRatingsMap
    : { ...savedRatingsMap, [pendingRating.insightId]: pendingRating.rating };

  /** Trocar de categoria troca a CHAVE da query, e a busca sai disso. */
  const handleCategoryClick = (categoryId) => {
    setActiveCategory(activeCategory === categoryId ? null : categoryId);
  };

  const handleRate = (insightId, rating) => {
    const insight = insights.find(({ id }) => id === insightId);

    if (insight === undefined) return;

    rateMutation.mutate({ insightId, rating, category: insight.category, title: insight.title });
  };

  const handleTabChange = (tab) => setActiveTab(tab);

  const handleRefresh = () => insightsQuery.refetch();

  return {
    activeTab,
    activeCategory,
    posts,
    insights,
    ratings,
    insightsFailure,
    /** Plano gratuito: veio so' o primeiro insight; o convite fica embaixo dele. */
    insightsLocked: !plan.full_reports && (insightsQuery.data ?? []).length > 0,
    isLoadingInsights: insightsQuery.isFetching,
    hasChildren: children.length > 0,
    handleTabChange,
    handleCategoryClick,
    handleRate,
    handleRefresh,
  };
}
