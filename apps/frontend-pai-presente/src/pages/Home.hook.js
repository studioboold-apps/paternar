/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePlanStatus } from '@/lib/use-plan';

import { api } from '@/api/client';
import { describeApiFailure } from '@/lib/api-error-message';
import { useTranslation } from '@/lib/i18n';
import { withStableIds } from '@/lib/insight-id';
import { createPageUrl } from '@/utils';

/**
 * A decisao da Home mora aqui (`web.md` §4): a pagina so recebe e desenha.
 * Antes disso, quatro queries, uma mutation com nota otimista e o desvio para o
 * cadastro dividiam arquivo com trezentas linhas de JSX — e nenhuma delas dava
 * para exercitar sem montar a tela inteira.
 */
export function useHome() {
  /** O idioma entra na chave: trocar de lingua pede insight novo, nao o guardado. */
  const { locale } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState(null);
  const [pendingRatings, setPendingRatings] = useState({});
  const [rateFailure, setRateFailure] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.entities.Child.list(),
  });

  const { data: savedRatings = [] } = useQuery({
    queryKey: ['insightRatings'],
    queryFn: () => api.entities.InsightRating.list(),
  });

  /**
   * `staleTime: Infinity` porque cada refeitura custa uma chamada de IA — quem
   * pede texto novo e' o botao de atualizar, deliberadamente. Sem isso, trocar
   * de aba do navegador gastava dinheiro.
   */
  const insightsQuery = useQuery({
    queryKey: ['insights', activeCategory, locale],
    queryFn: async () => withStableIds(await api.ai.insights(activeCategory ?? undefined)),
    enabled: Boolean(user) && children.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const insights = insightsQuery.data ?? [];
  const plan = usePlanStatus();
  const insightsFailure = insightsQuery.isError ? describeApiFailure(insightsQuery.error) : null;

  /** Sincronizar com o roteador e' efeito legitimo — sistema externo. */
  useEffect(() => {
    if (user && !user.onboarding_completed) {
      /**
       * `replace`: a Home sem cadastro nao e' lugar para onde se volta. Com
       * `push`, o "voltar" do celular caia na Home, que mandava de novo para o
       * cadastro — o pai ficava preso entre as duas.
       */
      navigate(createPageUrl('Onboarding'), { replace: true });
    }
  }, [user, navigate]);

  const savedRatingByInsightId = useMemo(
    () => Object.fromEntries(savedRatings.map(({ insight_id: insightId, rating }) => [insightId, rating])),
    [savedRatings],
  );

  const ratings = { ...savedRatingByInsightId, ...pendingRatings };

  const rateMutation = useMutation({
    mutationFn: ({ insight, rating }) => api.entities.InsightRating.rate({
      insight_id: insight.id,
      category: insight.category,
      rating,
      insight_title: insight.title,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insightRatings'] });
    },
    /** Falhou: a estrela volta ao que o servidor tem, e o pai fica sabendo. */
    onError: (error, { insight }) => {
      setPendingRatings((previous) => {
        const next = { ...previous };
        delete next[insight.id];
        return next;
      });
      setRateFailure(describeApiFailure(error));
    },
  });

  /** Trocar de categoria troca a CHAVE da query, e a busca sai disso. */
  const handleCategoryClick = (categoryId) => {
    setActiveCategory(activeCategory === categoryId ? null : categoryId);
  };

  const handleRate = (insightId, rating) => {
    const insight = insights.find(({ id }) => id === insightId);

    if (insight === undefined) return;

    setRateFailure(null);
    setPendingRatings((previous) => ({ ...previous, [insightId]: rating }));
    rateMutation.mutate({ insight, rating });
  };

  const handleRefresh = () => insightsQuery.refetch();

  const filteredInsights = activeCategory
    ? insights.filter(({ category }) => category === activeCategory)
    : insights;

  return {
    activeCategory,
    filteredInsights,
    ratings,
    rateFailure,
    insightsFailure,
    /** Plano gratuito: veio so' o primeiro insight; o convite fica embaixo dele. */
    insightsLocked: !plan.full_reports && (insightsQuery.data ?? []).length > 0,
    isLoadingInsights: insightsQuery.isFetching,
    hasChildren: children.length > 0,
    /** Sem nome, quem decide o que dizer e' a tela — texto nao mora no hook (§6). */
    firstName: user?.full_name?.split(' ')[0],
    handleCategoryClick,
    handleRate,
    handleRefresh,
  };
}
