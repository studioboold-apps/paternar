/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Enviar teste para mim": a chamada e o texto do resultado.
 */

/** Escopo que libera escolher o pai que recebe o teste (so admin). */
export const SEND_ANY_SCOPE = 'notifications:send-any';

/**
 * Sem `recipientUserId`, a API manda para a conta do app com o mesmo e-mail de
 * quem esta logado. Com ele (so admin), para o pai escolhido.
 */
export async function sendTemplateTest(client, templateKey, recipientUserId) {
  const payload = await client.requestJson(
    'POST',
    `/notification-templates/${encodeURIComponent(templateKey)}/test`,
    recipientUserId ? { recipientUserId } : undefined,
  );
  return payload?.data;
}

/** Ate 5 pais pela busca de nome ou e-mail, para o seletor do teste. */
export async function searchTestRecipients(client, search) {
  const term = search.trim();
  if (term.length < 2) return [];
  const params = new URLSearchParams({ page: '1', perPage: '5', search: term });
  const payload = await client.requestJson('GET', `/app-users?${params.toString()}`);
  return (payload?.data ?? [])
    .filter((user) => !user.blockedAt)
    .map((user) => ({ id: user.id, label: user.fullName ? `${user.fullName} (${user.email})` : user.email }));
}

const CHANNEL_LABEL = { inbox: 'caixa de entrada', push: 'push', email: 'e-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

/**
 * O que a tela diz depois do clique. O push e' o que importa: se ele nem
 * entrou no envio, o mais comum e' o aparelho nao ter ativado as notificacoes.
 */
export function describeTemplateTestResult(result, recipientLabel) {
  const deliveries = Array.isArray(result?.deliveries) ? result.deliveries : [];
  const channels = deliveries.map((delivery) => CHANNEL_LABEL[delivery.channel] ?? delivery.channel);
  const hasPush = deliveries.some((delivery) => delivery.channel === 'push');
  if (channels.length === 0) {
    return { ok: false, text: 'Nada foi enviado: nenhum canal ativo para esta categoria.' };
  }
  const who = recipientLabel ? ` para ${recipientLabel}` : '';
  const sentTo = `Teste enviado${who} (${channels.join(', ')}).`;
  if (hasPush) return { ok: true, text: recipientLabel ? sentTo : `${sentTo} Confira o celular.` };
  return {
    ok: true,
    text: recipientLabel
      ? `${sentTo} Sem push: esse pai não ativou as notificações no app.`
      : `${sentTo} Sem push: ative as notificações no app (Perfil) com a sua conta.`,
  };
}

export function describeTemplateTestError(error) {
  if (error?.code === 'APP_ACCOUNT_NOT_FOUND') {
    return 'Não há conta no app com o seu e-mail. Crie uma no app com o mesmo e-mail do painel.';
  }
  if (error?.code === 'RECIPIENT_NOT_FOUND') return 'Esse pai não existe mais ou está bloqueado.';
  if (error?.status === 403) return 'Seu acesso não pode enviar teste.';
  return error?.message || 'Não foi possível enviar o teste.';
}
