/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

/** Endereco publico do app, que vai no fim do texto compartilhado. */
export const APP_PUBLIC_URL = 'https://paternar.com.br';

/**
 * Texto do boletim para mandar no WhatsApp ou publicar na Comunidade.
 * Leva o que da' orgulho de mostrar (nota, pontos fortes, meta) e deixa de
 * fora os pontos de melhoria: e' o pai quem escolhe expor o que falta.
 *
 * @param {{ report: { nota_geral: number, pontos_fortes?: { titulo: string }[], meta_proximo_mes?: string },
 *   monthLabel: string, scoreLabel: string, t: (key: string, args?: object) => string, withLink?: boolean }} params
 */
export function buildBoletimShareText({ report, monthLabel, scoreLabel, t, withLink = true }) {
  const lines = [
    t('boletim.share.heading', { month: monthLabel }),
    t('boletim.share.score', { score: report.nota_geral, label: scoreLabel }),
  ];

  const strengths = (report.pontos_fortes ?? []).map((point) => point.titulo).filter(Boolean);
  if (strengths.length > 0) {
    lines.push('', t('boletim.share.strengths'), ...strengths.map((title) => `• ${title}`));
  }
  if (report.meta_proximo_mes) {
    lines.push('', t('boletim.share.goal', { goal: report.meta_proximo_mes }));
  }
  if (withLink) {
    lines.push('', t('boletim.share.footer', { url: APP_PUBLIC_URL }));
  }
  return lines.join('\n');
}
