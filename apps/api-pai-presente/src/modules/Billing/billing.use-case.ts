/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import {
  applyPaymentEvent,
  PAYMENT_EVENT_TYPES,
  subscriptionGrantsAccess,
  type IncomingWebhook,
  type PaymentEvent,
  type PaymentGateway,
} from '../../sdk/payments';
import type { AuthenticatedUser } from '../shared/auth/authenticated-user.interface';
import type { Logger } from '../shared/logger/logger';
import { BillingFeatureRequiredError, toBillingHttpError } from './billing.error';
import {
  BILLING_PLAN_CODES,
  FALLBACK_PAID_PLAN_CODE,
  type BillingFeature,
  type BillingPlan,
} from './billing.plans';
import type {
  BillingRepository,
  MySubscriptionView,
  PlanView,
  SubscriptionRecord,
} from './types/billing.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BillingUseCases = {
  receiveWebhook(params: { readonly provider: string } & IncomingWebhook): Promise<{ readonly duplicate: boolean }>;
  getMine(user: AuthenticatedUser, now?: Date): Promise<MySubscriptionView>;
  listPlans(user: AuthenticatedUser): Promise<readonly PlanView[]>;
  hasFeature(user: AuthenticatedUser, feature: BillingFeature): Promise<boolean>;
  /** Para as rotas que forem exigir plano: lanca 402 quando o plano nao libera. */
  requireFeature(user: AuthenticatedUser, feature: BillingFeature): Promise<void>;
};

export function createBillingUseCases({
  repository,
  gateway,
  plans,
  logger,
}: {
  readonly repository: BillingRepository;
  readonly gateway: PaymentGateway;
  readonly plans: readonly BillingPlan[];
  readonly logger?: Logger | undefined;
}): BillingUseCases {
  const freePlan = plans.find((plan) => plan.code === BILLING_PLAN_CODES.FREE);
  if (!freePlan) throw new Error('catalogo de planos sem o plano gratuito');

  /** Oferta do evento -> plano, pelo `off` do link de checkout de cada plano. */
  function planCodeForOffer(offerCode: string | null, current: string | undefined): string {
    const byOffer = plans.find(
      (plan) => plan.checkoutUrl && offerCode && gateway.checkout.readOfferCode(plan.checkoutUrl) === offerCode,
    );
    if (byOffer) return byOffer.code;
    if (current) return current;
    logger?.warn('pagamento com oferta que nao bate com nenhum plano; usando o plano pago padrao', { offerCode });
    return FALLBACK_PAID_PLAN_CODE;
  }

  /** Quem pagou: primeiro o id que o link levou, depois o e-mail. */
  async function resolveUserId(event: PaymentEvent): Promise<string | null> {
    if (event.customerRef && UUID_PATTERN.test(event.customerRef)) {
      const byRef = await repository.findUserIdById(event.customerRef);
      if (byRef) return byRef;
    }
    if (event.customer.email) return (await repository.findUserIdByEmail(event.customer.email)) ?? null;
    return null;
  }

  async function currentSubscription(user: AuthenticatedUser, now: Date): Promise<SubscriptionRecord | undefined> {
    const subscriptions = await repository.listForUser({ userId: user.userId, email: user.email });
    // A que libera acesso ganha; sem nenhuma, a mais recente (para mostrar "cancelada", "reembolsada").
    return subscriptions.find((subscription) => subscriptionGrantsAccess(subscription, now)) ?? subscriptions[0];
  }

  function planOf(code: string | undefined): BillingPlan {
    return plans.find((plan) => plan.code === code) ?? freePlan!;
  }

  async function getMine(user: AuthenticatedUser, now: Date = new Date()): Promise<MySubscriptionView> {
    const subscription = await currentSubscription(user, now);
    if (!subscription) {
      return {
        planCode: freePlan!.code,
        planName: freePlan!.name,
        status: 'none',
        hasAccess: false,
        features: freePlan!.features,
        periodEndsAt: null,
        provider: null,
      };
    }
    const hasAccess = subscriptionGrantsAccess(subscription, now);
    const plan = hasAccess ? planOf(subscription.planCode) : freePlan!;
    return {
      planCode: plan.code,
      planName: plan.name,
      status: subscription.status,
      hasAccess,
      features: plan.features,
      periodEndsAt: subscription.periodEndsAt,
      provider: subscription.provider,
    };
  }

  async function hasFeature(user: AuthenticatedUser, feature: BillingFeature): Promise<boolean> {
    return (await getMine(user)).features.includes(feature);
  }

  return {
    async receiveWebhook({ provider, headers, rawBody }) {
      let event: PaymentEvent;
      try {
        event = await gateway.receiveWebhook(provider, { headers, rawBody });
      } catch (error) {
        throw toBillingHttpError(error);
      }
      if (!event.subscriptionId && event.type !== PAYMENT_EVENT_TYPES.IGNORED) {
        logger?.warn('evento de pagamento sem assinatura nem transacao; so registrado', {
          provider: event.provider,
          type: event.providerEventType,
        });
      }
      const userId = await resolveUserId(event);
      const result = await repository.applyEvent({
        event,
        userId,
        decide(current) {
          if (!event.subscriptionId) return undefined;
          const state = applyPaymentEvent(current, event);
          if (!state) return undefined;
          return { state, planCode: planCodeForOffer(event.offerCode, current?.planCode) };
        },
      });
      logger?.info('webhook de pagamento recebido', {
        provider: event.provider,
        type: event.providerEventType,
        duplicate: result.outcome === 'duplicate',
        status: result.outcome === 'recorded' ? result.subscription?.status : undefined,
        linkedToUser: userId !== null,
      });
      return { duplicate: result.outcome === 'duplicate' };
    },

    getMine,

    async listPlans(user) {
      const mine = await getMine(user);
      return plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        features: plan.features,
        checkoutUrl: plan.checkoutUrl
          ? gateway.checkout.buildCheckoutUrl({ baseUrl: plan.checkoutUrl, customerRef: user.userId, email: user.email })
          : null,
        current: plan.code === mine.planCode,
      }));
    },

    hasFeature,

    async requireFeature(user, feature) {
      if (!(await hasFeature(user, feature))) throw new BillingFeatureRequiredError(feature);
    },
  };
}
