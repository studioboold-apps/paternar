/**
 * Paternar — painel da equipe
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Acoes que mais de uma tela faz (lista, ficha, denuncia). A rota e' uma so'.
 */

import { PANEL_TEXT } from './panel-text';

/**
 * Bloqueia ou libera o pai, depois de perguntar. Devolve o `blockedAt` novo,
 * ou `undefined` quando a equipe desistiu.
 */
export async function setUserBlocked(client, user, willBlock) {
  const name = user.fullName || user.email;
  const text = PANEL_TEXT.users;
  if (!window.confirm(willBlock ? text.confirmBlock(name) : text.confirmUnblock(name))) return undefined;
  const result = await client.requestJson('PUT', `/app-users/${encodeURIComponent(user.id)}/blocked`, { blocked: willBlock });
  return result?.data?.blockedAt ?? null;
}

/**
 * Varias denuncias do mesmo conteudo viram um cartao so': a equipe decide uma
 * vez, e a API fecha todas juntas.
 */
export function groupReports(rows) {
  const groups = new Map();
  for (const report of rows) {
    const target = report.targetType === 'comment' ? report.commentId : report.postId;
    const key = `${report.targetType}:${target ?? report.id}`;
    const group = groups.get(key);
    if (group) group.reports.push(report);
    else groups.set(key, { key, reports: [report] });
  }
  return [...groups.values()];
}
