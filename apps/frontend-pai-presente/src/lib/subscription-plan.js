/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * O que a secao de plano mostra, decidido longe da tela. A API ja vem em
 * snake_case (`api/keys.js`).
 */

/** Situacao em que a data importa: o acesso vale ate ela, e o pai precisa saber. */
const STATUSES_WITH_END_DATE = Object.freeze(['canceled', 'past_due']);

/** O checkout preferido de cada plano: o primeiro que a API devolveu. */
export function checkoutUrlOf(plan) {
  return plan?.checkouts?.[0]?.url ?? null;
}

/**
 * Os planos que valem um botao: pagos, que nao sao o atual e que tem checkout.
 * Plano sem link (oferta ainda nao configurada) nao aparece: botao que nao leva
 * a lugar nenhum e' pior que botao nenhum.
 */
export function plansToOffer(plans, entitlement) {
  const hasAccess = entitlement?.has_access === true;
  return (plans ?? []).filter(
    (plan) => !plan.is_free && checkoutUrlOf(plan) && !(hasAccess && plan.code === entitlement.plan_code),
  );
}

/** A data do fim do acesso, so' quando ela muda o que o pai faz. */
export function accessEndsAt(entitlement) {
  if (!entitlement?.has_access || !STATUSES_WITH_END_DATE.includes(entitlement.status)) return null;
  return entitlement.period_ends_at ?? null;
}

/** Recursos sem traducao conhecida nao aparecem como chave crua na tela. */
export function knownFeatures(features, isKnown) {
  return (features ?? []).filter((feature) => isKnown(feature));
}
