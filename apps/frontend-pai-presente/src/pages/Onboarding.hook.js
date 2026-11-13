/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planBlockOf } from '@/lib/use-plan';

import { api } from '@/api/client';
import { describeApiFailure } from '@/lib/api-error-message';
import { toProfileUpdate } from '@/lib/profile-form';
import { createPageUrl } from '@/utils';

/** O passo e' identidade estavel; o titulo que a pessoa le vem do locale (§6). */
export const ONBOARDING_STEPS = Object.freeze(['welcome', 'about', 'preferences', 'children']);

const EMPTY_CHILD = Object.freeze({
  name: '',
  age: '',
  gender: '',
  favorite_hobby: '',
  favorite_color: '',
  favorite_food: '',
  favorite_movie_genre: '',
  avatar_url: null,
});

export function useOnboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => api.auth.me() });

  /** Quem ja concluiu e chega aqui (link, historico) vai para a Home, sem refazer. */
  useEffect(() => {
    if (user?.onboarding_completed) navigate(createPageUrl('Home'), { replace: true });
  }, [user, navigate]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState({ age: '', marital_status: '', city: '', avatar_url: null });
  const [children, setChildren] = useState([]);
  const [saveFailure, setSaveFailure] = useState(null);
  const [newChild, setNewChild] = useState(EMPTY_CHILD);

  const stepId = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (!isLastStep) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleUserFieldChange = (field, value) => {
    setUserData((previous) => ({ ...previous, [field]: value }));
  };

  const handleNewChildFieldChange = (field, value) => {
    setNewChild((previous) => ({ ...previous, [field]: value }));
  };

  const canAddChild = Boolean(newChild.name && newChild.age && newChild.gender);

  const handleAddChild = () => {
    if (!canAddChild) return;

    setChildren((previous) => [...previous, { ...newChild, age: Number.parseInt(newChild.age, 10) }]);
    setNewChild(EMPTY_CHILD);
  };

  const handleRemoveChild = (index) => {
    setChildren((previous) => previous.filter((_, position) => position !== index));
  };

  const handleComplete = async () => {
    setIsSaving(true);
    setSaveFailure(null);
    try {
      /**
       * Idade em branco virava `NaN` e depois `null` no corpo, e a API recusava
       * a conclusao INTEIRA do onboarding — os filhos nem chegavam a ser
       * criados. O corpo se monta no mesmo modulo que o Perfil usa.
       */
      await api.auth.updateMe({ ...toProfileUpdate(userData), onboarding_completed: true });

      for (const child of children) {
        try {
          await api.entities.Child.create(child);
        } catch (error) {
          // Plano gratuito com limite de filhos: o cadastro termina com os que couberam.
          if (planBlockOf(error)) break;
          throw error;
        }
      }

      /**
       * A Home le `['currentUser']` do CACHE antes de refazer a busca, e o
       * cache ainda dizia `onboarding_completed: false` — ela mandava o pai de
       * volta para ca na mesma hora, com tudo ja salvo (medido em producao em
       * 31/10/2026). `invalidate` nao basta: so marca como velho, e a Home
       * desenharia o valor velho mesmo assim. Remover obriga a Home a esperar
       * o servidor. Os filhos entram pelo mesmo motivo.
       */
      queryClient.removeQueries({ queryKey: ['currentUser'] });
      queryClient.removeQueries({ queryKey: ['children'] });
      /**
       * `replace`: o cadastro concluido sai da pilha. Com `push`, o "voltar"
       * reabria o formulario ja preenchido e salvo.
       */
      navigate(createPageUrl('Home'), { replace: true });
    } catch (error) {
      /**
       * Antes daqui so saia `console.error`: o botao voltava de "Salvando..." e
       * nada acontecia. O pai nao tem console — para ele o aplicativo apenas nao
       * salvava. A recusa da API ja nomeia os campos; agora ela chega na tela.
       */
      setSaveFailure(describeApiFailure(error));
    }
    setIsSaving(false);
  };

  /** So o passo "sobre voce" e o dos filhos exigem preenchimento. */
  const canProceed = stepId === 'about'
    ? Boolean(userData.age)
    : stepId !== 'children' || children.length > 0;

  return {
    stepId,
    stepNumber: currentStep + 1,
    stepCount: ONBOARDING_STEPS.length,
    currentStep,
    isLastStep,
    isSaving,
    userData,
    userName: user?.full_name ?? '',
    children,
    newChild,
    saveFailure,
    canAddChild,
    canProceed,
    handleNext,
    handleBack,
    handleUserFieldChange,
    handleNewChildFieldChange,
    handleAddChild,
    handleRemoveChild,
    handleComplete,
  };
}
