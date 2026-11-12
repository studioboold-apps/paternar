/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Enviar teste" do editor de modelos no painel.
 *
 * Sem destinatario, o teste vai para a conta do app com o mesmo e-mail de quem
 * esta logado no painel. Escolher outro pai e' permissao separada, so do
 * admin (`notifications:send-any`): quem edita texto nao ganha, junto, o
 * poder de mandar push com a marca para qualquer pai.
 *
 * Sai pelo mesmo `sendNotification` das notificacoes de verdade (politica,
 * preferencia e fila inclusas): um caminho paralelo provaria a entrega de um
 * caminho que a producao nao usa.
 */

import type { DeliverySummary } from '@adatechnology/notification-contracts';
import type { NotificationModule } from '@adatechnology/notification-module';

import { NOTIFICATION_COMPANY_ID } from './notification.constant';
import { TEMPLATE_EXAMPLE_VALUES } from './template-variables';

/** O teste usa os mesmos exemplos do preview, marcados como teste no titulo. */
export const TEMPLATE_TEST_PAYLOAD = Object.freeze({
  ...TEMPLATE_EXAMPLE_VALUES,
  title: `${TEMPLATE_EXAMPLE_VALUES['title']} (teste)`,
});

/** O prefixo da chave diz a categoria; modelo criado no painel cai em `avisos`. */
const CATEGORY_BY_PREFIX: readonly (readonly [string, string])[] = [
  ['atividade', 'atividades'],
  ['comunidade', 'comunidade'],
  ['boletim', 'boletim'],
  ['insight', 'boletim'],
  ['avisos', 'avisos'],
];
const FALLBACK_CATEGORY = 'avisos';

export function categoryForTemplateKey(templateKey: string): string {
  const key = templateKey.trim().toLowerCase();
  const match = CATEGORY_BY_PREFIX.find(([prefix]) => key.startsWith(prefix));
  return match ? match[1] : FALLBACK_CATEGORY;
}

export class AppAccountNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'APP_ACCOUNT_NOT_FOUND';
  constructor() {
    super('Nenhuma conta no app com o e-mail deste acesso do painel. Crie uma no app com o mesmo e-mail.');
  }
}

export class RecipientNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'RECIPIENT_NOT_FOUND';
  constructor() {
    super('Pai nao encontrado ou bloqueado.');
  }
}

export class InvalidTemplateKeyError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  constructor() {
    super('Chave de modelo invalida.');
  }
}

export type SendTemplateTestResult = {
  readonly notificationId: string;
  readonly recipientUserId: string;
  readonly templateKey: string;
  readonly category: string;
  readonly deliveries: readonly Pick<DeliverySummary, 'channel' | 'status'>[];
};

export type SendTemplateTest = (input: {
  readonly staffUserId: string;
  readonly templateKey: string;
  /** Pai escolhido no painel. A rota so repassa quando quem pede e' admin. */
  readonly recipientUserId?: string | undefined;
}) => Promise<SendTemplateTestResult>;

const MAX_TEMPLATE_KEY_LENGTH = 120;

export function createSendTemplateTest(dependencies: {
  readonly notification: Pick<NotificationModule, 'useCases'>;
  /** Conta do app (pai) com o mesmo e-mail do acesso do painel. */
  readonly findAppUserIdForStaff: (staffUserId: string) => Promise<string | undefined>;
  /** Pai existe e nao esta bloqueado. */
  readonly isActiveAppUser: (userId: string) => Promise<boolean>;
  readonly newDedupeKey?: () => string;
  readonly companyId?: string;
}): SendTemplateTest {
  const newDedupeKey = dependencies.newDedupeKey ?? (() => `template-test-${crypto.randomUUID()}`);

  async function resolveRecipient(staffUserId: string, chosen: string | undefined): Promise<string> {
    if (chosen !== undefined) {
      if (!(await dependencies.isActiveAppUser(chosen))) throw new RecipientNotFoundError();
      return chosen;
    }
    const own = await dependencies.findAppUserIdForStaff(staffUserId);
    if (!own) throw new AppAccountNotFoundError();
    return own;
  }

  return async ({ staffUserId, templateKey, recipientUserId: chosen }) => {
    const key = templateKey.trim();
    if (key.length === 0 || key.length > MAX_TEMPLATE_KEY_LENGTH) throw new InvalidTemplateKeyError();

    const recipientUserId = await resolveRecipient(staffUserId, chosen);

    const category = categoryForTemplateKey(key);
    const result = await dependencies.notification.useCases.sendNotification.execute({
      companyId: dependencies.companyId ?? NOTIFICATION_COMPANY_ID,
      recipientUserId,
      category,
      templateKey: key,
      payload: TEMPLATE_TEST_PAYLOAD,
      // Chave nova a cada clique: chave repetida devolve a notificacao antiga
      // sem enviar nada, e um teste que "passa" sem enviar e' pior que um que falha.
      dedupeKey: newDedupeKey(),
    });

    return {
      notificationId: result.notificationId,
      recipientUserId,
      templateKey: key,
      category,
      deliveries: result.deliveries.map((delivery) => ({ channel: delivery.channel, status: delivery.status })),
    };
  };
}
