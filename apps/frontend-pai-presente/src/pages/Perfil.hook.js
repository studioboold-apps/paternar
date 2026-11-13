/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { planBlockOf } from '@/lib/use-plan';

import { api } from '@/api/client';
import { describeApiFailure } from '@/lib/api-error-message';
import { useAuth } from '@/lib/AuthContext';
import { toAverageGrade } from '@/lib/average-grade';
import { toProfileUpdate } from '@/lib/profile-form';
import { useChildFromLink } from '@/lib/child-from-link';
import { createEmptyChildForm } from '@/lib/profile-options';

export function usePerfil() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [childToDelete, setChildToDelete] = useState(null);
  const [childForm, setChildForm] = useState(createEmptyChildForm);
  const [childForFiles, setChildForFiles] = useState(null);

  /**
   * O formulario e' preenchido quando o dialogo ABRE, e nao a cada resposta
   * nova da consulta do usuario. Do jeito antigo bastava a janela reganhar o
   * foco no meio da edicao para a busca se refazer e apagar por baixo o que o
   * pai estava digitando.
   */
  const [profileForm, setProfileForm] = useState({ age: '', marital_status: '', city: '' });

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => api.auth.me() });
  const { data: children = [] } = useQuery({ queryKey: ['children'], queryFn: () => api.entities.Child.list() });
  const { data: ratings = [] } = useQuery({
    queryKey: ['insightRatings'],
    queryFn: () => api.entities.InsightRating.list(),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => api.entities.Activity.list(),
  });

  /** A foto do pai salva sozinha, no toque: nao passa pelo dialogo de editar. */
  const updateAvatarMutation = useMutation({
    mutationFn: (avatarUrl) => api.auth.updateMe({ avatar_url: avatarUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setShowEditProfile(false);
    },
  });

  const createChildMutation = useMutation({
    mutationFn: (data) => api.entities.Child.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setShowAddChild(false);
      setChildForm(createEmptyChildForm());
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Child.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      setEditingChild(null);
      setChildForm(createEmptyChildForm());
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: (id) => api.entities.Child.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  /**
   * Tres escritas, tres avisos. Antes, qualquer recusa da API morria no
   * `onError` que nao existia: o dialogo continuava aberto e mudo, e o pai
   * clicava em Salvar de novo achando que o toque nao tinha pegado.
   */
  const profileFailure = updateProfileMutation.isError ? describeApiFailure(updateProfileMutation.error) : null;
  /** Filho alem do que o plano libera: convite para assinar, nao aviso de erro. */
  const childPlanBlock = createChildMutation.isError ? planBlockOf(createChildMutation.error) : null;
  const childFailure = childPlanBlock
    ? null
    : createChildMutation.isError
    ? describeApiFailure(createChildMutation.error)
    : updateChildMutation.isError
      ? describeApiFailure(updateChildMutation.error)
      : null;
  const deleteFailure = deleteChildMutation.isError ? describeApiFailure(deleteChildMutation.error) : null;

  /**
   * Sem nota nenhuma, o cartao mostrava `0` — que e' a PIOR nota possivel, nao
   * a ausencia dela. O modulo comum devolve nada nesse caso, e a tela escreve
   * um traco; a mesma conta e' a do boletim, e por isso mora num lugar so.
   */
  const averageGrade = toAverageGrade(ratings.filter((rating) => rating.rating).map((rating) => rating.rating));
  const completedActivities = activities.filter((activity) => activity.completed).length;

  function handleOpenEditProfile() {
    setProfileForm({ age: user?.age ?? '', marital_status: user?.marital_status ?? '', city: user?.city ?? '' });
    updateProfileMutation.reset();
    setShowEditProfile(true);
  }

  function handleProfileFieldChange(field, value) {
    setProfileForm((previous) => ({ ...previous, [field]: value }));
  }

  function handleSaveProfile() {
    updateProfileMutation.mutate(toProfileUpdate(profileForm));
  }

  function handleOpenAddChild() {
    createChildMutation.reset();
    setChildForm(createEmptyChildForm());
    setEditingChild(null);
    setShowAddChild(true);
  }

  function handleOpenEditChild(child) {
    setChildForm({
      name: child.name,
      age: child.age.toString(),
      gender: child.gender,
      favorite_hobby: child.favorite_hobby ?? '',
      favorite_color: child.favorite_color ?? '',
      favorite_food: child.favorite_food ?? '',
      favorite_movie_genre: child.favorite_movie_genre ?? '',
      avatar_url: child.avatar_url ?? null,
    });
    updateChildMutation.reset();
    setEditingChild(child);
  }

  useChildFromLink({ children, onOpen: handleOpenEditChild });

  /** Historico e album ficam DENTRO da ficha do filho (feedback do design). */
  function handleOpenChildFiles(child) {
    setEditingChild(null);
    setChildForFiles(child);
  }

  function handleCloseChildFiles() {
    setChildForFiles(null);
  }

  function handleChangeAvatar(avatarUrl) {
    updateAvatarMutation.mutate(avatarUrl);
  }

  function handleCloseChildDialog() {
    setShowAddChild(false);
    setEditingChild(null);
  }

  function handleChildFieldChange(field, value) {
    setChildForm((previous) => ({ ...previous, [field]: value }));
  }

  function handleSaveChild() {
    const data = { ...childForm, age: Number.parseInt(childForm.age, 10) };
    if (editingChild) {
      updateChildMutation.mutate({ id: editingChild.id, data });
      return;
    }
    createChildMutation.mutate(data);
  }

  function handleConfirmDelete() {
    if (childToDelete !== null) deleteChildMutation.mutate(childToDelete.id);
    setChildToDelete(null);
  }

  /**
   * Sair passa pelo contexto: chamar a API direto derruba o cookie e deixa o
   * `user` em memoria, e a tela continua mostrando o pai que acabou de sair.
   */
  function handleLogout() {
    logout();
  }

  return {
    user,
    children,
    averageGrade,
    completedActivities,
    profileForm,
    childForm,
    editingChild,
    childToDelete,
    isChildDialogOpen: showAddChild || editingChild !== null,
    isEditProfileOpen: showEditProfile,
    isSavingProfile: updateProfileMutation.isPending,
    isSavingChild: createChildMutation.isPending || updateChildMutation.isPending,
    canSaveChild: Boolean(childForm.name && childForm.age && childForm.gender),
    profileFailure,
    childFailure,
    childPlanBlock,
    deleteFailure,
    setShowEditProfile,
    setChildToDelete,
    handleOpenEditProfile,
    handleProfileFieldChange,
    handleSaveProfile,
    handleOpenAddChild,
    handleOpenEditChild,
    handleCloseChildDialog,
    handleChildFieldChange,
    handleSaveChild,
    handleConfirmDelete,
    handleLogout,
    childForFiles,
    handleOpenChildFiles,
    handleCloseChildFiles,
    handleChangeAvatar,
    isSavingAvatar: updateAvatarMutation.isPending,
    avatarFailure: updateAvatarMutation.isError ? describeApiFailure(updateAvatarMutation.error) : null,
  };
}
