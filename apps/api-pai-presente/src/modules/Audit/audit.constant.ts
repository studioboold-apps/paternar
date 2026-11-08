/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

/** Acoes sensiveis que deixam trilha (`security.md` §10). */
export const AUDIT_ACTIONS = {
  ACCOUNT_DELETED: 'account_deleted',
  ACCOUNT_EXPORTED: 'account_exported',
  /**
   * Foto e exame deixam trilha SEPARADA, e nao um `child_file_written` unico:
   * exame e' dado de saude sensivel (LGPD art. 11), e o relatorio que a
   * autoridade pede e' "quem mexeu em exame", nao "quem mexeu em arquivo".
   */
  CHILD_PHOTO_UPLOADED: 'child_photo_uploaded',
  CHILD_EXAM_UPLOADED: 'child_exam_uploaded',
  /**
   * LEITURA de exame deixa trilha; leitura de foto NAO. A trilha do art. 46 da
   * LGPD existe para poder responder "quem viu o dado de saude desta crianca, e
   * quando" — e carimbar cada foto que o album pinta na tela encheria a mesma
   * tabela de milhares de linhas por sessao, afogando exatamente a linha que a
   * pergunta procura.
   */
  CHILD_EXAM_READ: 'child_exam_read',
  /**
   * Apagar deixa trilha, e as duas metades do art. 18 explicam por que: o pai
   * tem direito a eliminacao E direito a saber o que foi feito com o dado. A
   * linha da tabela desaparece; sem esta, nada no sistema sabe que ela existiu.
   */
  CHILD_PHOTO_DELETED: 'child_photo_deleted',
  CHILD_EXAM_DELETED: 'child_exam_deleted',
  /**
   * O consentimento do art. 14 §1 e a retirada dele (art. 8 §5) deixam trilha,
   * e sao as linhas que dao HISTORICO a uma tabela que guarda so' o estado
   * atual: `child_consents` tem uma linha por finalidade, e revogar a apaga.
   * Sem estas duas acoes, "quando este pai consentiu, e por quanto tempo" seria
   * pergunta sem resposta no dia em que alguem a fizesse.
   */
  CHILD_CONSENT_GRANTED: 'child_consent_granted',
  CHILD_CONSENT_REVOKED: 'child_consent_revoked',
  /**
   * Religiao, politica e orientacao sexual sao dado sensivel (art. 11). Gravar
   * so' acontece com o aceite marcado, entao `SAVED` e' tambem a trilha do
   * consentimento; `DELETED` e' a retirada dele.
   */
  FAMILY_VALUES_SAVED: 'family_values_saved',
  FAMILY_VALUES_DELETED: 'family_values_deleted',
  /**
   * O que a EQUIPE faz no painel tambem deixa trilha (LGPD art. 37): quem abriu
   * a ficha de um pai, quem tirou um post do ar, quem arquivou uma denuncia.
   * O `actor_id` destas linhas e' o acesso da equipe (schema `user`), nao um pai;
   * o prefixo `panel_` e' o que separa as duas trilhas na consulta.
   */
  PANEL_USER_VIEWED: 'panel_user_viewed',
  PANEL_CONTENT_REMOVED: 'panel_content_removed',
  PANEL_REPORT_DISMISSED: 'panel_report_dismissed',
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_TARGET_TYPES = {
  ACCOUNT: 'account',
  CHILD_FILE: 'child_file',
  CHILD_CONSENT: 'child_consent',
  FAMILY_VALUES: 'family_values',
  COMMUNITY_REPORT: 'community_report',
} as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[keyof typeof AUDIT_TARGET_TYPES];
