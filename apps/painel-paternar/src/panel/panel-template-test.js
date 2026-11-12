/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * "Enviar teste para mim": a chamada e o texto do resultado.
 */

/**
 * Sem destinatario no corpo, de proposito: a API manda para a conta do app com
 * o mesmo e-mail de quem esta logado no painel, e para mais ninguem.
 */
export async function sendTemplateTest(client, templateKey) {
  const payload = await client.requestJson('POST', `/notification-templates/${encodeURIComponent(templateKey)}/test`);
  return payload?.data;
}

const CHANNEL_LABEL = { inbox: 'caixa de entrada', push: 'push', email: 'e-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

/**
 * O que a tela diz depois do clique. O push e' o que importa: se ele nem
 * entrou no envio, o mais comum e' o aparelho nao ter ativado as notificacoes.
 */
export function describeTemplateTestResult(result) {
  const deliveries = Array.isArray(result?.deliveries) ? result.deliveries : [];
  const channels = deliveries.map((delivery) => CHANNEL_LABEL[delivery.channel] ?? delivery.channel);
  const hasPush = deliveries.some((delivery) => delivery.channel === 'push');
  if (channels.length === 0) {
    return { ok: false, text: 'Nada foi enviado: nenhum canal ativo para esta categoria.' };
  }
  const sentTo = `Teste enviado (${channels.join(', ')}).`;
  if (hasPush) return { ok: true, text: `${sentTo} Confira o celular.` };
  return {
    ok: true,
    text: `${sentTo} Sem push: ative as notificações no app (Perfil) com a sua conta.`,
  };
}

export function describeTemplateTestError(error) {
  if (error?.code === 'APP_ACCOUNT_NOT_FOUND') {
    return 'Não há conta no app com o seu e-mail. Crie uma no app com o mesmo e-mail do painel.';
  }
  if (error?.status === 403) return 'Seu acesso não pode enviar teste.';
  return error?.message || 'Não foi possível enviar o teste.';
}
