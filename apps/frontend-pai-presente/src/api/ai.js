/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { getLocale } from '@/lib/locale';

import { HTTP_METHODS, request, requestUpload } from './http';

/**
 * O prompt nao mora mais aqui. Ele montava a pergunta com a orientacao
 * religiosa e politica do pai DENTRO do navegador, o que punha dado sensivel
 * no bundle e na aba de rede; agora a API monta, e a tela so pede o resultado.
 */
const PATHS = Object.freeze({
  insights: '/v1/insights',
  suggestions: '/v1/activity-suggestions',
  report: '/v1/report',
  chat: '/v1/chat',
  transcriptions: '/v1/chat/transcriptions',
});

/** O nome do campo e' o que a API le; a extensao e' so' cortesia — quem decide o formato sao os bytes. */
const AUDIO_FORM_FIELD = 'audio';

/**
 * O boletim fala portugues na tela e ingles no contrato. O mapa e EXPLICITO
 * porque nenhuma regra de traducao liga `grade` a `nota_geral`.
 */
function toPageReport(report) {
  return {
    nota_geral: report.grade,
    pontos_fortes: report.strengths.map(({ title, description }) => ({
      titulo: title,
      descricao: description,
    })),
    pontos_melhoria: report.improvements.map(({ title, description }) => ({
      titulo: title,
      descricao: description,
    })),
    mensagem_motivacional: report.motivational_message,
    meta_proximo_mes: report.next_month_goal,
    /** Plano gratuito: veio so' a nota e a mensagem. */
    bloqueado: report.locked === true,
  };
}

/**
 * Todo pedido a IA leva o idioma escolhido no app: a resposta tem de falar a
 * mesma lingua que a tela em volta dela. E' lido na hora do pedido, nao quando
 * o modulo carrega, porque o pai pode trocar de idioma no meio da sessao.
 */
function withLocale(body) {
  return { ...body, locale: getLocale() };
}

export const ai = Object.freeze({
  /** `category` vazio pede insight de todas as categorias. */
  insights: async (category) => {
    const { insights } = await request(HTTP_METHODS.POST, PATHS.insights, {
      body: withLocale(category === undefined ? {} : { category }),
    });
    return insights;
  },

  /**
   * Sem `childId`, a sugestao vale para a familia toda.
   *
   * @param {{ month?: string, childId?: string }} [params]
   */
  activitySuggestions: async ({ month, childId } = {}) => {
    const { suggestions } = await request(HTTP_METHODS.POST, PATHS.suggestions, {
      body: withLocale({
        ...(month === undefined ? {} : { month }),
        ...(childId === undefined ? {} : { childId }),
      }),
    });
    return suggestions;
  },

  report: async (month) => {
    const report = await request(HTTP_METHODS.POST, PATHS.report, { body: withLocale({ month }) });
    return toPageReport(report);
  },

  /**
   * Devolve o texto puro: a tela guarda `{ role, content }`, nao um envelope.
   *
   * O historico NAO viaja daqui: a API le as ultimas falas da conversa do
   * proprio pai no banco. `images` sao `{ mediaType, data }` em base64, e
   * so' as da pergunta atual.
   */
  chat: async (message, { images = [] } = {}) => {
    const body = withLocale(images.length === 0 ? { message } : { message, images });
    const { reply } = await request(HTTP_METHODS.POST, PATHS.chat, { body });
    return reply;
  },

  /** O audio vai, o texto volta; a API nao guarda o audio. */
  transcribe: async (audio) => {
    const form = new FormData();
    const extension = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
    form.append(AUDIO_FORM_FIELD, audio, `gravacao.${extension}`);
    const { text } = await requestUpload(PATHS.transcriptions, { form });
    return text;
  },
});
