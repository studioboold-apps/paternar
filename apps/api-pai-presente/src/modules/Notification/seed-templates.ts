/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Semeia templates padrao e politicas de roteamento nas categorias:
 * - Atividades e Rotina (`atividades`)
 * - Comunidade (`comunidade`)
 * - Boletim e Conquistas (`boletim`)
 * - Avisos da Plataforma (`avisos`)
 * nos canais: inbox, push, email e whatsapp.
 */

import { sql } from 'drizzle-orm';
import type { Database } from '../../database/client';
import { NOTIFICATION_COMPANY_ID } from './notification.constant';

export type SeedTemplateItem = {
  readonly key: string;
  readonly channel: 'inbox' | 'push' | 'email' | 'whatsapp';
  readonly locale: string;
  readonly subject: string;
  readonly body: string;
};

/**
 * Versao dos textos padrao. O boot so INSERE (nunca sobrescreve), e o envio usa
 * a maior versao ativa: subir este numero publica os textos novos sem apagar o
 * historico, e um modelo que alguem ja editou no painel (versao igual ou maior)
 * continua valendo.
 *
 * v2: emojis, quebras de linha e *negrito* no WhatsApp.
 */
export const SEED_TEMPLATE_VERSION = 2;

export const DEFAULT_NOTIFICATION_TEMPLATES: readonly SeedTemplateItem[] = [
  // --------------------------------------------------------------------------
  // 1. Categoria Atividades e Rotina
  // --------------------------------------------------------------------------
  // atividades.agendada
  {
    key: 'atividades.agendada',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '📅 Atividade agendada!',
    body: 'Você marcou "{{title}}" para {{activityDate}}{{activityTime}}.\n\nAproveite esse momento com seus filhos! 💙',
  },
  {
    key: 'atividades.agendada',
    channel: 'push',
    locale: 'pt-BR',
    subject: '📅 Momento agendado!',
    body: '"{{title}}" em {{activityDate}}{{activityTime}}. Vai ser especial! 💙',
  },
  {
    key: 'atividades.agendada',
    channel: 'email',
    locale: 'pt-BR',
    subject: '📅 Atividade agendada: {{title}}',
    body: 'Olá! 👋\n\nVocê agendou a atividade "{{title}}" para {{activityDate}}{{activityTime}}.\n\nMomentos como esse fortalecem o vínculo com seus filhos. 💙\n\nEquipe Paternar',
  },
  {
    key: 'atividades.agendada',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Atividade agendada',
    body: '📅 *Atividade agendada!*\n\n*{{title}}*\n🗓️ {{activityDate}}{{activityTime}}\n\nBom momento com seus filhos! 💙\n_Paternar_',
  },

  // atividades.lembrete
  {
    key: 'atividades.lembrete',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '⏰ Daqui a pouco: {{title}}',
    body: 'Sua atividade "{{title}}" começa em breve.\n\nPrepare-se para esse momento com seus filhos! 🙌',
  },
  {
    key: 'atividades.lembrete',
    channel: 'push',
    locale: 'pt-BR',
    subject: '⏰ Daqui a pouco tem atividade!',
    body: '"{{title}}" começa em breve. Prepare-se! 🙌',
  },
  {
    key: 'atividades.lembrete',
    channel: 'email',
    locale: 'pt-BR',
    subject: '⏰ Lembrete: {{title}} daqui a pouco',
    body: 'Olá! 👋\n\nDaqui a pouco é hora da atividade "{{title}}".\n\nAproveitem cada instante juntos! 🙌\n\nEquipe Paternar',
  },
  {
    key: 'atividades.lembrete',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Lembrete de atividade',
    body: '⏰ *Lembrete!*\n\nSua atividade *{{title}}* começa em breve. 🙌\n\nAbra o app do Paternar para ver os detalhes.',
  },

  // atividades.concluida
  {
    key: 'atividades.concluida',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '🎉 Momento concluído!',
    body: 'Parabéns por dedicar tempo de qualidade em "{{title}}"! 👏\n\nVeja seu progresso no Boletim. 📈',
  },
  {
    key: 'atividades.concluida',
    channel: 'push',
    locale: 'pt-BR',
    subject: '🎉 Parabéns pelo momento especial!',
    body: 'Você concluiu "{{title}}"! Tempo de qualidade faz toda a diferença. 👏',
  },
  {
    key: 'atividades.concluida',
    channel: 'email',
    locale: 'pt-BR',
    subject: '🎉 Parabéns! Atividade concluída',
    body: 'Parabéns! 🎉\n\nVocê concluiu a atividade "{{title}}". O registro já está salvo no Boletim dos seus filhos. 📈\n\nEquipe Paternar',
  },
  {
    key: 'atividades.concluida',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Atividade concluída',
    body: '🎉 *Parabéns!*\n\nVocê concluiu *{{title}}* com seus filhos. 👏\n\n_Continue presente nessa jornada._ 💙',
  },

  // atividades.incentivo
  {
    key: 'atividades.incentivo',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '💡 Que tal planejar um momento juntos?',
    body: 'Reserve um tempo na sua agenda esta semana para uma atividade especial com as crianças. 🧩⚽🎨',
  },
  {
    key: 'atividades.incentivo',
    channel: 'push',
    locale: 'pt-BR',
    subject: '💡 Um momento com os filhos?',
    body: 'Que tal reservar um tempo especial com as crianças esta semana? Abra a Agenda e planeje! 📅',
  },
  {
    key: 'atividades.incentivo',
    channel: 'email',
    locale: 'pt-BR',
    subject: '💡 Ideias para momentos em família nesta semana',
    body: 'Olá! 👋\n\nSeparamos sugestões de atividades para a faixa etária dos seus filhos. 🧩⚽🎨\n\nAcesse o Paternar e confira!\n\nEquipe Paternar',
  },
  {
    key: 'atividades.incentivo',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Momento em família',
    body: '💡 *Que tal um momento em família hoje?*\n\nDê uma olhada nas sugestões de atividades no Paternar. 🧩⚽🎨',
  },

  // --------------------------------------------------------------------------
  // 2. Categoria Comunidade
  // --------------------------------------------------------------------------
  // comunidade.comentario
  {
    key: 'comunidade.comentario',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '💬 Novo comentário no seu relato',
    body: 'Outro pai comentou no seu post na Comunidade:\n\n"{{commentText}}"',
  },
  {
    key: 'comunidade.comentario',
    channel: 'push',
    locale: 'pt-BR',
    subject: '💬 Comentaram no seu post',
    body: '"{{commentText}}" Toque para responder. 👉',
  },
  {
    key: 'comunidade.comentario',
    channel: 'email',
    locale: 'pt-BR',
    subject: '💬 Novo comentário no seu post na Comunidade',
    body: 'Olá! 👋\n\nSeu post recebeu um novo comentário:\n\n"{{commentText}}"\n\nAcesse o Paternar para responder.\n\nEquipe Paternar',
  },
  {
    key: 'comunidade.comentario',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Comentário na Comunidade',
    body: '💬 *Novo comentário no seu post!*\n\n_"{{commentText}}"_\n\nVenha conversar na Comunidade do Paternar. 🤝',
  },

  // comunidade.resposta
  {
    key: 'comunidade.resposta',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '↩️ Responderam ao seu comentário',
    body: 'Alguém respondeu ao seu comentário na Comunidade. Toque para acompanhar a conversa. 🤝',
  },
  {
    key: 'comunidade.resposta',
    channel: 'push',
    locale: 'pt-BR',
    subject: '↩️ Nova resposta na Comunidade',
    body: 'Responderam ao seu comentário. Toque para ver a conversa! 🤝',
  },
  {
    key: 'comunidade.resposta',
    channel: 'email',
    locale: 'pt-BR',
    subject: '↩️ Nova resposta ao seu comentário',
    body: 'Olá! 👋\n\nSua participação na Comunidade gerou novas respostas. 🤝\n\nAcesse o Paternar para conferir.\n\nEquipe Paternar',
  },
  {
    key: 'comunidade.resposta',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Resposta na Comunidade',
    body: '↩️ *Responderam ao seu comentário!*\n\nVeja a conversa na Comunidade de pais do Paternar. 🤝',
  },

  // --------------------------------------------------------------------------
  // 3. Categoria Boletim e Conquistas
  // --------------------------------------------------------------------------
  // boletim.conquista
  {
    key: 'boletim.conquista',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '🏆 Nova conquista de {{childName}}!',
    body: 'Você registrou uma nova conquista para {{childName}}:\n\n⭐ "{{title}}"\n\nCada passo conta! 💙',
  },
  {
    key: 'boletim.conquista',
    channel: 'push',
    locale: 'pt-BR',
    subject: '🏆 Nova conquista de {{childName}}!',
    body: '⭐ "{{title}}" está no Boletim. Cada passo conta! 💙',
  },
  {
    key: 'boletim.conquista',
    channel: 'email',
    locale: 'pt-BR',
    subject: '🏆 Novo marco de {{childName}} no Paternar',
    body: 'Olá! 👋\n\nUma nova conquista foi registrada para {{childName}}:\n\n⭐ "{{title}}"\n\nCada passo conta no desenvolvimento! 💙\n\nEquipe Paternar',
  },
  {
    key: 'boletim.conquista',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Nova conquista registrada',
    body: '🏆 *Nova conquista de {{childName}}!*\n\n⭐ {{title}}\n\n_Cada passo conta._ 💙',
  },

  // boletim.insight_semanal
  {
    key: 'boletim.insight_semanal',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '✨ Dica da semana: {{title}}',
    body: '{{summary}}\n\n💡 Toque para ver a dica completa para a idade dos seus filhos.',
  },
  {
    key: 'boletim.insight_semanal',
    channel: 'push',
    locale: 'pt-BR',
    subject: '✨ Dica da semana do Paternar',
    body: '💡 {{title}}. Toque para conferir!',
  },
  {
    key: 'boletim.insight_semanal',
    channel: 'email',
    locale: 'pt-BR',
    subject: '✨ Boletim da semana: {{title}}',
    body: 'Olá! 👋\n\nConfira o resumo da semana e a dica para seus filhos.\n\n💡 {{title}}\n\n{{summary}}\n\nEquipe Paternar',
  },
  {
    key: 'boletim.insight_semanal',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Dica da semana',
    body: '✨ *Dica da semana*\n\n💡 *{{title}}*\n\n{{summary}}\n\n_Paternar_',
  },

  // --------------------------------------------------------------------------
  // 4. Categoria Avisos da Plataforma
  // --------------------------------------------------------------------------
  // avisos.boas_vindas
  {
    key: 'avisos.boas_vindas',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '👋 Bem-vindo ao Paternar!',
    body: 'Estamos muito felizes em ter você aqui! 💙\n\n📅 Explore a Agenda\n👶 Cadastre seus filhos\n💬 Participe da Comunidade',
  },
  {
    key: 'avisos.boas_vindas',
    channel: 'push',
    locale: 'pt-BR',
    subject: '👋 Bem-vindo ao Paternar!',
    body: 'Sua jornada de paternidade ativa começa aqui. Toque para explorar! 💙',
  },
  {
    key: 'avisos.boas_vindas',
    channel: 'email',
    locale: 'pt-BR',
    subject: '👋 Bem-vindo ao Paternar!',
    body: 'Olá! 👋\n\nSeja bem-vindo ao Paternar. Aqui você encontra:\n\n📅 Agenda de atividades com seus filhos\n📈 Boletim com as conquistas deles\n💬 Uma comunidade de pais para trocar experiências\n\nEstamos juntos nessa jornada! 💙\n\nEquipe Paternar',
  },
  {
    key: 'avisos.boas_vindas',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Boas-vindas ao Paternar',
    body: '👋 *Seja bem-vindo ao Paternar!*\n\n📅 Agenda de atividades\n📈 Boletim de conquistas\n💬 Comunidade de pais\n\n_Estamos juntos na jornada de uma paternidade ativa e presente._ 💙',
  },

  // avisos.plataforma
  {
    key: 'avisos.plataforma',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: '📢 Comunicado do Paternar',
    body: 'Temos atualizações e avisos importantes na plataforma. Confira as novidades! ✨',
  },
  {
    key: 'avisos.plataforma',
    channel: 'push',
    locale: 'pt-BR',
    subject: '📢 Novidades no Paternar',
    body: 'Preparamos novidades no aplicativo. Toque para saber mais! ✨',
  },
  {
    key: 'avisos.plataforma',
    channel: 'email',
    locale: 'pt-BR',
    subject: '📢 Novidades no Paternar',
    body: 'Olá! 👋\n\nPreparamos melhorias para tornar sua experiência ainda melhor. ✨\n\nAcesse o aplicativo e confira.\n\nEquipe Paternar',
  },
  {
    key: 'avisos.plataforma',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Aviso da plataforma',
    body: '📢 *Novidades no Paternar!*\n\nAtualizamos recursos para ajudar no dia a dia com seus filhos. ✨',
  },
];

export const DEFAULT_CATEGORY_POLICIES: readonly {
  readonly category: string;
  readonly channel: string;
  readonly enabled: boolean;
}[] = [
  // Atividades e Rotina
  { category: 'atividades', channel: 'inbox', enabled: true },
  { category: 'atividades', channel: 'push', enabled: true },
  { category: 'atividades', channel: 'email', enabled: true },
  { category: 'atividades', channel: 'whatsapp', enabled: true },

  // Comunidade
  { category: 'comunidade', channel: 'inbox', enabled: true },
  { category: 'comunidade', channel: 'push', enabled: true },
  { category: 'comunidade', channel: 'email', enabled: true },
  { category: 'comunidade', channel: 'whatsapp', enabled: true },

  // Boletim e Conquistas
  { category: 'boletim', channel: 'inbox', enabled: true },
  { category: 'boletim', channel: 'push', enabled: true },
  { category: 'boletim', channel: 'email', enabled: true },
  { category: 'boletim', channel: 'whatsapp', enabled: true },

  // Avisos da Plataforma
  { category: 'avisos', channel: 'inbox', enabled: true },
  { category: 'avisos', channel: 'push', enabled: true },
  { category: 'avisos', channel: 'email', enabled: true },
  { category: 'avisos', channel: 'whatsapp', enabled: true },
];

/**
 * Chaves da primeira versao, antes de padronizar em `categoria.evento`. A
 * semente gravou as duas e o painel mostrava cada modelo em dobro; as antigas
 * sao desativadas no boot, como o "Remover" do painel faz (da para reativar).
 */
export const LEGACY_TEMPLATE_KEYS: readonly string[] = [
  'atividade_agendada',
  'atividade_lembrete',
  'atividade_concluida',
  'atividade_incentivo',
  'boletim_conquista',
  'comunidade_comentario',
  'insight_semanal',
];

export async function bootstrapNotificationTemplates(
  db: Database,
  companyId: string = NOTIFICATION_COMPANY_ID,
): Promise<{ templatesCount: number; policiesCount: number }> {
  let templatesCount = 0;
  let policiesCount = 0;

  // 1. Semeia os modelos padrao em notification.templates
  for (const t of DEFAULT_NOTIFICATION_TEMPLATES) {
    try {
      await db.execute(sql`
        INSERT INTO notification.templates (
          id, company_id, key, channel, locale, version, subject, body, active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${companyId}::uuid, ${t.key}, ${t.channel}, ${t.locale}, ${SEED_TEMPLATE_VERSION}, ${t.subject}, ${t.body}, true, now(), now()
        )
        ON CONFLICT (company_id, key, channel, locale, version) DO NOTHING;
      `);
      templatesCount++;
    } catch {
      // Ignora se tabela notification.templates ainda nao tiver sido criada por migration
    }
  }

  // 1b. Desativa as chaves antigas que ainda estiverem ativas
  try {
    await db.execute(sql`
      UPDATE notification.templates
         SET active = false, updated_at = now()
       WHERE company_id = ${companyId}::uuid
         AND active = true
         AND key IN (${sql.join(LEGACY_TEMPLATE_KEYS.map((key) => sql`${key}`), sql`, `)});
    `);
  } catch {
    // Tabela ainda nao criada pela migration: nada a desativar
  }

  // 2. Semeia politicas de roteamento padrao em notification.category_policies
  for (const p of DEFAULT_CATEGORY_POLICIES) {
    try {
      await db.execute(sql`
        INSERT INTO notification.category_policies (
          id, company_id, category, channel, enabled, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${companyId}::uuid, ${p.category}, ${p.channel}, ${p.enabled}, now(), now()
        )
        ON CONFLICT (company_id, category, channel) DO NOTHING;
      `);
      policiesCount++;
    } catch {
      // Ignora se tabela notification.category_policies ainda nao tiver sido criada por migration
    }
  }

  return { templatesCount, policiesCount };
}
