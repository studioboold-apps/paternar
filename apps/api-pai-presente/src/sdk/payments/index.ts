/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Porta de entrada do SDK de pagamentos. O app importa daqui, e so daqui.
 */

export * from './payments.constant';
export * from './payments.error';
export * from './payments.gateway';
export * from './payments.status';
export type * from './payments.types';
export * from './providers/fake.provider';
export * from './providers/hotmart.provider';
