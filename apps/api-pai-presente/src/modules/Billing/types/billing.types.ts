/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { PaymentEvent, SubscriptionState, SubscriptionStatus } from '../../../sdk/payments';
import type { BillingFeature, BillingPlanCode } from '../billing.plans';

export type SubscriptionRecord = SubscriptionState & {
  readonly id: string;
  readonly userId: string | null;
  readonly provider: string;
  readonly externalId: string;
  readonly customerEmail: string | null;
  readonly planCode: string;
  readonly offerCode: string | null;
  readonly canceledAt: Date | null;
  readonly updatedAt: Date;
};

/** O que o use case decide para a assinatura, a partir do estado atual. */
export type SubscriptionDecision = {
  readonly state: SubscriptionState;
  readonly planCode: string;
};

export type ApplyEventResult =
  | { readonly outcome: 'duplicate' }
  | { readonly outcome: 'recorded'; readonly subscription: SubscriptionRecord | undefined };

export type BillingRepository = {
  /**
   * Numa transacao: grava o evento (ou devolve `duplicate` se ja veio), trava a
   * assinatura, pede a `decide` o proximo estado e grava. `decide` devolvendo
   * `undefined` deixa a assinatura como esta.
   */
  applyEvent(params: {
    readonly event: PaymentEvent;
    readonly userId: string | null;
    readonly decide: (current: SubscriptionRecord | undefined) => SubscriptionDecision | undefined;
  }): Promise<ApplyEventResult>;
  /** O id do usuario, se existir. Recebe texto livre (veio do provedor). */
  findUserIdById(candidate: string): Promise<string | undefined>;
  findUserIdByEmail(email: string): Promise<string | undefined>;
  /**
   * As assinaturas do pai, ja amarrando as que chegaram sem dono com o e-mail
   * dele. Mais recente primeiro.
   */
  listForUser(params: { readonly userId: string; readonly email: string }): Promise<readonly SubscriptionRecord[]>;
};

export type MySubscriptionView = {
  readonly planCode: BillingPlanCode | string;
  readonly planName: string;
  readonly status: SubscriptionStatus | 'none';
  readonly hasAccess: boolean;
  readonly features: readonly BillingFeature[];
  readonly periodEndsAt: Date | null;
  readonly provider: string | null;
};

export type PlanView = {
  readonly code: BillingPlanCode;
  readonly name: string;
  readonly description: string;
  readonly interval: 'none' | 'month' | 'year';
  readonly features: readonly BillingFeature[];
  /** Ja com o pai marcado; `null` no gratuito ou sem link configurado. */
  readonly checkoutUrl: string | null;
  readonly current: boolean;
};
