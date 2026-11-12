/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { NOTIFICATION_COMPANY_ID } from '../Notification/notification.constant';
import { API_VERSION_PREFIX } from '../shared/http/http.constant';

/** Tudo do painel mora aqui embaixo: nenhuma rota da equipe colide com rota de pai. */
export const PANEL_BASE_PATH = `${API_VERSION_PREFIX}/panel`;

/** `user-module` e `notification-module` compartilham o ID de empresa (UUID compativel com PostgreSQL). */
export const PANEL_COMPANY_ID = NOTIFICATION_COMPANY_ID;

/**
 * Papeis da EQUIPE. O papel mora no token do `user-module`; o que cada um pode
 * fazer mora aqui, numa tabela so, para nao haver rota que pergunte papel por
 * conta propria.
 */
export const PANEL_ROLES = {
  /** Tudo, inclusive criar outros acessos. */
  ADMIN: 'admin',
  /** Cadastra anunciantes e recomendacoes, ve os numeros. Nao cria acessos. */
  EDITOR: 'editor',
  /** So olha. */
  VIEWER: 'viewer',
} as const;

export type PanelRole = (typeof PANEL_ROLES)[keyof typeof PANEL_ROLES];

export const PANEL_SCOPES = {
  READ: 'panel:read',
  USERS_ADMIN: 'user:admin',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  CUSTOMERS_ADMIN: 'customers:admin',
  RECOMMENDATIONS_ADMIN: 'recommendations:admin',
  /** Bloquear e desbloquear pais do app. So admin: tira alguem do produto. */
  APP_USERS_BLOCK: 'app-users:block',
  /** Arquivar denuncia e tirar post ou comentario do ar. */
  COMMUNITY_MODERATE: 'community:moderate',
  /** Editar modelos e politicas de notificacao e enviar teste para si. */
  NOTIFICATIONS_ADMIN: 'notifications:admin',
} as const;

const EDITOR_SCOPES = [
  PANEL_SCOPES.READ,
  PANEL_SCOPES.CUSTOMERS_READ,
  PANEL_SCOPES.CUSTOMERS_WRITE,
  PANEL_SCOPES.RECOMMENDATIONS_ADMIN,
  PANEL_SCOPES.COMMUNITY_MODERATE,
  PANEL_SCOPES.NOTIFICATIONS_ADMIN,
] as const;

export const SCOPES_BY_ROLE: Readonly<Record<PanelRole, readonly string[]>> = {
  [PANEL_ROLES.ADMIN]: [
    ...EDITOR_SCOPES,
    PANEL_SCOPES.USERS_ADMIN,
    PANEL_SCOPES.CUSTOMERS_ADMIN,
    PANEL_SCOPES.APP_USERS_BLOCK,
  ],
  [PANEL_ROLES.EDITOR]: EDITOR_SCOPES,
  [PANEL_ROLES.VIEWER]: [PANEL_SCOPES.READ, PANEL_SCOPES.CUSTOMERS_READ],
};

/**
 * Categoria do anunciante: um campo `select` do cadastro de clientes
 * (`customer-module`). Fica no catalogo do banco, editavel pelo painel; isto e'
 * so a semente do primeiro boot.
 */
export const ADVERTISER_CATEGORY_FIELD = {
  name: 'categoria',
  label: 'Categoria',
  type: 'select',
  required: false,
  filterable: false,
  options: [
    { value: 'parque', label: 'Parque e ar livre' },
    { value: 'restaurante', label: 'Restaurante e café' },
    { value: 'buffet', label: 'Buffet e festa' },
    { value: 'cultura', label: 'Museu, teatro e cultura' },
    { value: 'esporte', label: 'Esporte e atividade' },
    { value: 'educacao', label: 'Curso e educação' },
    { value: 'saude', label: 'Saúde' },
    { value: 'loja', label: 'Loja' },
    { value: 'servico', label: 'Serviço' },
  ],
} as const;
