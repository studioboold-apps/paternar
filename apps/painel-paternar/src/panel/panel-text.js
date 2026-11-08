/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O painel e' da EQUIPE, nao dos pais: fala so portugues, e por isso os textos
 * moram aqui e nao nas chaves de traducao do app (`web.md` §6 vale para as
 * telas do pai, que existem em tres idiomas).
 */

export const PANEL_TEXT = Object.freeze({
  title: 'Painel Paternar',
  subtitle: 'Área da equipe',
  email: 'E-mail',
  password: 'Senha',
  signIn: 'Entrar',
  signingIn: 'Entrando…',
  signInFailed: 'E-mail ou senha não conferem.',
  signOut: 'Sair',
  loading: 'Carregando…',
  tabs: {
    overview: 'Visão geral',
    users: 'Pais cadastrados',
    advertisers: 'Anunciantes',
    recommendations: 'Recomendações',
  },
  overview: {
    users: 'Pais cadastrados',
    onboarded: 'Concluíram o cadastro',
    last7: 'Novos em 7 dias',
    last30: 'Novos em 30 dias',
    children: 'Filhos cadastrados',
    posts: 'Posts na comunidade',
    signups: 'Cadastros por dia (30 dias)',
  },
  users: {
    search: 'Buscar por nome ou e-mail',
    name: 'Nome',
    email: 'E-mail',
    city: 'Cidade',
    children: 'Filhos',
    onboarding: 'Cadastro',
    complete: 'Completo',
    incomplete: 'Incompleto',
    since: 'Desde',
    empty: 'Nenhum pai encontrado.',
    previous: 'Anterior',
    next: 'Próxima',
    privacy: 'Por privacidade, o painel não mostra foto, idade, estado civil nem dados dos filhos.',
    status: 'Situação',
    active: 'Ativo',
    blocked: 'Bloqueado',
    block: 'Bloquear',
    unblock: 'Desbloquear',
    saving: 'Salvando…',
    onlyAdmins: 'Só administradores podem bloquear pais.',
    confirmBlock: (name) =>
      `Bloquear ${name}? Ele sai do app na hora e não consegue entrar de novo até ser desbloqueado.`,
    confirmUnblock: (name) => `Desbloquear ${name}? Ele volta a poder entrar no app.`,
  },
  advertisers: {
    new: 'Novo anunciante',
    back: 'Voltar à lista',
    name: 'Nome do anunciante',
    phone: 'WhatsApp (com DDD)',
    email: 'E-mail',
    category: 'Categoria',
    save: 'Cadastrar',
    settings: 'Campos e categorias',
  },
});
