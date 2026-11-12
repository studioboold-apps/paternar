/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Constantes do modulo de notificacoes do Paternar.
 */

/**
 * UUID fixo da empresa Paternar / Entrelacos em instalacoes single-tenant.
 * Obrigatorio ser UUID valido para compatibilidade com o PostgreSQL (`company_id uuid NOT NULL`)
 * nas tabelas `notification.templates`, `notification.category_policies`, `notification.devices`, etc.
 */
export const NOTIFICATION_COMPANY_ID = 'a0000000-0000-4000-8000-000000000001';
