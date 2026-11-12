/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Enviar teste para mim" do editor de modelos no painel.
 *
 * A rota NAO aceita destinatario, e essa ausencia e' a regra de seguranca
 * inteira: o teste vai para a conta do app com o mesmo e-mail de quem esta
 * logado no painel, e para mais ninguem. Com um campo de destino, a tela de
 * editar texto viraria um jeito de mandar push com a marca para qualquer pai.
 *
 * Sai pelo mesmo `sendNotification` das notificacoes de verdade (politica,
 * preferencia e fila inclusas): um caminho paralelo provaria a entrega de um
 * caminho que a producao nao usa.
 */

import type { DeliverySummary } from '@adatechnology/notification-contracts';
import type { NotificationModule } from '@adatechnology/notification-module';

import { NOTIFICATION_COMPANY_ID } from './notification.constant';

/** Valores de exemplo para todas as variaveis que os modelos padrao usam. */
export const TEMPLATE_TEST_PAYLOAD = Object.freeze({
  title: 'Piquenique no parque (teste)',
  description: 'Mensagem de teste enviada pelo painel.',
  activityDate: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  activityTime: ' às 10:00',
  childName: 'Seu filho',
  commentText: 'Que ideia boa! (teste)',
  summary: 'Resumo de exemplo da semana (teste).',
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

export class InvalidTemplateKeyError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  constructor() {
    super('Chave de modelo invalida.');
  }
}

export type SendTemplateTestResult = {
  readonly notificationId: string;
  readonly templateKey: string;
  readonly category: string;
  readonly deliveries: readonly Pick<DeliverySummary, 'channel' | 'status'>[];
};

export type SendTemplateTest = (input: {
  readonly staffUserId: string;
  readonly templateKey: string;
}) => Promise<SendTemplateTestResult>;

const MAX_TEMPLATE_KEY_LENGTH = 120;

export function createSendTemplateTest(dependencies: {
  readonly notification: Pick<NotificationModule, 'useCases'>;
  /** Conta do app (pai) com o mesmo e-mail do acesso do painel. */
  readonly findAppUserIdForStaff: (staffUserId: string) => Promise<string | undefined>;
  readonly newDedupeKey?: () => string;
  readonly companyId?: string;
}): SendTemplateTest {
  const newDedupeKey = dependencies.newDedupeKey ?? (() => `template-test-${crypto.randomUUID()}`);

  return async ({ staffUserId, templateKey }) => {
    const key = templateKey.trim();
    if (key.length === 0 || key.length > MAX_TEMPLATE_KEY_LENGTH) throw new InvalidTemplateKeyError();

    const recipientUserId = await dependencies.findAppUserIdForStaff(staffUserId);
    if (!recipientUserId) throw new AppAccountNotFoundError();

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
      templateKey: key,
      category,
      deliveries: result.deliveries.map((delivery) => ({ channel: delivery.channel, status: delivery.status })),
    };
  };
}
