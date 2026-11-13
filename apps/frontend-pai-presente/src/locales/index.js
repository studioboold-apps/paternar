/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import activityCard from '@/components/ActivityCard.locale.json';
import insightCard from '@/components/InsightCard.locale.json';
import notificationBanner from '@/components/NotificationPermissionBanner.locale.json';
import notificationInbox from '@/components/NotificationInbox.locale.json';
import planSection from '@/components/PerfilPlanSection.locale.json';
import planUpsell from '@/components/PlanUpsell.locale.json';
import signIn from '@/components/SignIn.locale.json';
import boletim from '@/pages/Boletim.locale.json';
import chat from '@/pages/Chat.locale.json';
import comunidade from '@/pages/Comunidade.locale.json';
import home from '@/pages/Home.locale.json';
import juntinhos from '@/pages/Juntinhos.locale.json';
import onboarding from '@/pages/Onboarding.locale.json';
import perfil from '@/pages/Perfil.locale.json';
import activities from './activities.locale.json';
import common from './common.locale.json';
import community from './community.locale.json';
import insights from './insights.locale.json';
import profile from './profile.locale.json';
import activityCardEN from '@/components/ActivityCard.locale.en.json';
import insightCardEN from '@/components/InsightCard.locale.en.json';
import notificationBannerEN from '@/components/NotificationPermissionBanner.locale.en.json';
import notificationInboxEN from '@/components/NotificationInbox.locale.en.json';
import planSectionEN from '@/components/PerfilPlanSection.locale.en.json';
import planUpsellEN from '@/components/PlanUpsell.locale.en.json';
import signInEN from '@/components/SignIn.locale.en.json';
import boletimEN from '@/pages/Boletim.locale.en.json';
import chatEN from '@/pages/Chat.locale.en.json';
import comunidadeEN from '@/pages/Comunidade.locale.en.json';
import homeEN from '@/pages/Home.locale.en.json';
import juntinhosEN from '@/pages/Juntinhos.locale.en.json';
import onboardingEN from '@/pages/Onboarding.locale.en.json';
import perfilEN from '@/pages/Perfil.locale.en.json';
import activitiesEN from './activities.locale.en.json';
import commonEN from './common.locale.en.json';
import communityEN from './community.locale.en.json';
import insightsEN from './insights.locale.en.json';
import profileEN from './profile.locale.en.json';
import activityCardES from '@/components/ActivityCard.locale.es.json';
import insightCardES from '@/components/InsightCard.locale.es.json';
import notificationBannerES from '@/components/NotificationPermissionBanner.locale.es.json';
import notificationInboxES from '@/components/NotificationInbox.locale.es.json';
import planSectionES from '@/components/PerfilPlanSection.locale.es.json';
import planUpsellES from '@/components/PlanUpsell.locale.es.json';
import signInES from '@/components/SignIn.locale.es.json';
import boletimES from '@/pages/Boletim.locale.es.json';
import chatES from '@/pages/Chat.locale.es.json';
import comunidadeES from '@/pages/Comunidade.locale.es.json';
import homeES from '@/pages/Home.locale.es.json';
import juntinhosES from '@/pages/Juntinhos.locale.es.json';
import onboardingES from '@/pages/Onboarding.locale.es.json';
import perfilES from '@/pages/Perfil.locale.es.json';
import activitiesES from './activities.locale.es.json';
import commonES from './common.locale.es.json';
import communityES from './community.locale.es.json';
import insightsES from './insights.locale.es.json';
import profileES from './profile.locale.es.json';

/**
 * O escopo NAO se repete dentro do arquivo: `Boletim.locale.json` guarda
 * `score.excellent`, e o prefixo `boletim.` nasce aqui. Escrever o escopo nos
 * dois lugares e' a mesma palavra em duas fontes — divergem na primeira edicao,
 * e a chave que some vira o proprio texto na tela sem nada quebrar.
 *
 * Escopo compartilhado mora nesta pasta; escopo de uma tela so mora ao lado
 * dela, para nascer e morrer junto com a tela.
 *
 * O portugues e' a ORIGEM (`*.locale.json`); cada traducao mora ao lado dela,
 * com o idioma no nome (`*.locale.en.json`, `*.locale.es.json`). Assim quem
 * cria uma frase ve, na mesma pasta, os arquivos que ainda nao a tem — e
 * `i18n-locales.test.js` reprova a chave que faltar em qualquer um deles.
 */
export const LOCALE_MESSAGES = Object.freeze({
  activities: activities,
  activityCard: activityCard,
  boletim: boletim,
  chat: chat,
  common: common,
  community: community,
  comunidade: comunidade,
  home: home,
  insightCard: insightCard,
  insights: insights,
  juntinhos: juntinhos,
  notificationBanner: notificationBanner,
  notificationInbox: notificationInbox,
  onboarding: onboarding,
  perfil: perfil,
  planSection: planSection,
  planUpsell: planUpsell,
  profile: profile,
  signIn: signIn,
});

const EN_MESSAGES = Object.freeze({
  activities: activitiesEN,
  activityCard: activityCardEN,
  boletim: boletimEN,
  chat: chatEN,
  common: commonEN,
  community: communityEN,
  comunidade: comunidadeEN,
  home: homeEN,
  insightCard: insightCardEN,
  insights: insightsEN,
  juntinhos: juntinhosEN,
  notificationBanner: notificationBannerEN,
  notificationInbox: notificationInboxEN,
  onboarding: onboardingEN,
  perfil: perfilEN,
  planSection: planSectionEN,
  planUpsell: planUpsellEN,
  profile: profileEN,
  signIn: signInEN,
});

const ES_MESSAGES = Object.freeze({
  activities: activitiesES,
  activityCard: activityCardES,
  boletim: boletimES,
  chat: chatES,
  common: commonES,
  community: communityES,
  comunidade: comunidadeES,
  home: homeES,
  insightCard: insightCardES,
  insights: insightsES,
  juntinhos: juntinhosES,
  notificationBanner: notificationBannerES,
  notificationInbox: notificationInboxES,
  onboarding: onboardingES,
  perfil: perfilES,
  planSection: planSectionES,
  planUpsell: planUpsellES,
  profile: profileES,
  signIn: signInES,
});

/** As chaves batem com `SUPPORTED_LOCALES` em `lib/locale.js`. */
export const MESSAGES_BY_LOCALE = Object.freeze({
  'pt-BR': LOCALE_MESSAGES,
  en: EN_MESSAGES,
  es: ES_MESSAGES,
});
