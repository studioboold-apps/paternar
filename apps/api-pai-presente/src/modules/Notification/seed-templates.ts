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

export const DEFAULT_NOTIFICATION_TEMPLATES: readonly SeedTemplateItem[] = [
  // --------------------------------------------------------------------------
  // 1. Categoria Atividades e Rotina
  // --------------------------------------------------------------------------
  // atividades.agendada
  {
    key: 'atividades.agendada',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Atividade agendada!',
    body: 'Você marcou a atividade "{{title}}" para {{activityDate}}{{activityTime}}. Aproveite esse momento com seus filhos!',
  },
  {
    key: 'atividades.agendada',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Momento agendado!',
    body: 'Você marcou: "{{title}}" para {{activityDate}}{{activityTime}}.',
  },
  {
    key: 'atividades.agendada',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Atividade agendada no Paternar: {{title}}',
    body: 'Olá! Você agendou a atividade "{{title}}" para {{activityDate}}{{activityTime}}. Momentos como esse fortalecem o vínculo com seus filhos.',
  },
  {
    key: 'atividades.agendada',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Atividade agendada',
    body: 'Olá! Você marcou a atividade *{{title}}* para {{activityDate}}{{activityTime}} no Paternar. Bom momento com seus filhos!',
  },
  // Alias atividade_agendada
  {
    key: 'atividade_agendada',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Atividade agendada!',
    body: 'Você marcou a atividade "{{title}}" para {{activityDate}}{{activityTime}}.',
  },
  {
    key: 'atividade_agendada',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Momento agendado!',
    body: 'Você marcou: "{{title}}" para {{activityDate}}{{activityTime}}.',
  },
  {
    key: 'atividade_agendada',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Atividade agendada no Paternar: {{title}}',
    body: 'Você agendou a atividade "{{title}}" para {{activityDate}}{{activityTime}}.',
  },
  {
    key: 'atividade_agendada',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Atividade agendada',
    body: 'Você marcou a atividade *{{title}}* para {{activityDate}}{{activityTime}}.',
  },

  // atividades.lembrete
  {
    key: 'atividades.lembrete',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Lembrete de momento especial',
    body: 'Daqui a pouco tem atividade: "{{title}}". Prepare-se para esse momento com seus filhos!',
  },
  {
    key: 'atividades.lembrete',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Lembrete de atividade',
    body: 'Daqui a pouco tem: "{{title}}". Prepare-se!',
  },
  {
    key: 'atividades.lembrete',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Lembrete: atividade {{title}} hoje',
    body: 'Lembrete do Paternar: daqui a pouco é hora da atividade "{{title}}". Aproveitem cada instante juntos!',
  },
  {
    key: 'atividades.lembrete',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Lembrete de atividade',
    body: 'Lembrete: sua atividade *{{title}}* acontece em breve! Abra o app do Paternar para ver os detalhes.',
  },
  // Alias atividade_lembrete
  {
    key: 'atividade_lembrete',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Lembrete de momento especial',
    body: 'Daqui a pouco tem atividade: "{{title}}". Prepare-se para esse momento especial!',
  },
  {
    key: 'atividade_lembrete',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Lembrete de atividade',
    body: 'Daqui a pouco tem: "{{title}}". Prepare-se!',
  },
  {
    key: 'atividade_lembrete',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Lembrete de atividade: {{title}}',
    body: 'Lembrete da atividade "{{title}}". Bom proveito!',
  },
  {
    key: 'atividade_lembrete',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Lembrete de atividade',
    body: 'Lembrete: *{{title}}* acontece em breve!',
  },

  // atividades.concluida
  {
    key: 'atividades.concluida',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Momento concluído!',
    body: 'Parabéns por dedicar tempo de qualidade na atividade "{{title}}"! Veja seu progresso no Boletim.',
  },
  {
    key: 'atividades.concluida',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Parabéns pelo momento especial!',
    body: 'Você concluiu "{{title}}"! O tempo de qualidade faz a diferença no crescimento dos seus filhos.',
  },
  {
    key: 'atividades.concluida',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Parabéns pela atividade concluída!',
    body: 'Parabéns! Você concluiu a atividade "{{title}}". O registro já está salvo no Boletim dos seus filhos.',
  },
  {
    key: 'atividades.concluida',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Atividade concluída',
    body: 'Parabéns por concluir a atividade *{{title}}* com seus filhos! Continue presente nessa jornada.',
  },
  // Alias atividade_concluida
  {
    key: 'atividade_concluida',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Momento concluído!',
    body: 'Parabéns por dedicar tempo de qualidade na atividade "{{title}}"! Veja seu progresso no Boletim.',
  },
  {
    key: 'atividade_concluida',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Parabéns pelo momento especial!',
    body: 'Você concluiu "{{title}}"! O tempo de qualidade faz a diferença.',
  },

  // atividades.incentivo
  {
    key: 'atividades.incentivo',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Que tal planejar um momento juntos?',
    body: 'Reserve um tempo na sua agenda esta semana para uma atividade especial com as crianças.',
  },
  {
    key: 'atividades.incentivo',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Momento com os filhos',
    body: 'Que tal reservar um momento especial com as crianças esta semana? Abra a Agenda e planeje!',
  },
  {
    key: 'atividades.incentivo',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Ideias para momentos em família nesta semana',
    body: 'Separamos sugestões de atividades para a faixa etária dos seus filhos. Acesse o Paternar e confira!',
  },
  {
    key: 'atividades.incentivo',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Momento em família',
    body: 'Que tal planejar uma atividade com seus filhos hoje? Dê uma olhada nas sugestões no Paternar.',
  },
  // Alias atividade_incentivo
  {
    key: 'atividade_incentivo',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Que tal planejar um momento juntos?',
    body: 'Reserve um tempo na sua agenda esta semana para uma atividade especial com as crianças.',
  },
  {
    key: 'atividade_incentivo',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Momento com os filhos',
    body: 'Que tal reservar um momento especial com as crianças esta semana? Abra a Agenda e planeje!',
  },

  // --------------------------------------------------------------------------
  // 2. Categoria Comunidade
  // --------------------------------------------------------------------------
  // comunidade.comentario
  {
    key: 'comunidade.comentario',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Novo comentário no seu relato',
    body: 'Outro pai comentou no seu post na Comunidade: "{{commentText}}".',
  },
  {
    key: 'comunidade.comentario',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Comentário na Comunidade',
    body: 'Responderam ao seu post na Comunidade de pais. Toque para ver!',
  },
  {
    key: 'comunidade.comentario',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Novo comentário no seu post na Comunidade Paternar',
    body: 'Seu post recebeu um novo comentário: "{{commentText}}". Acesse o Paternar para responder.',
  },
  {
    key: 'comunidade.comentario',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Comentário na Comunidade',
    body: 'Outro pai comentou no seu post na Comunidade do Paternar: "{{commentText}}". Venha interagir!',
  },
  // Alias comunidade_comentario
  {
    key: 'comunidade_comentario',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Novo comentário no seu relato',
    body: 'Outro pai comentou no seu post na Comunidade: "{{commentText}}".',
  },
  {
    key: 'comunidade_comentario',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Comentário na Comunidade',
    body: 'Responderam ao seu post na Comunidade de pais. Toque para ver!',
  },

  // comunidade.resposta
  {
    key: 'comunidade.resposta',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Responderam ao seu comentário',
    body: 'Alguém respondeu ao seu comentário na Comunidade. Toque para acompanhar a conversa.',
  },
  {
    key: 'comunidade.resposta',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Resposta na Comunidade',
    body: 'Responderam ao seu comentário na Comunidade de pais.',
  },
  {
    key: 'comunidade.resposta',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Nova resposta ao seu comentário no Paternar',
    body: 'Sua participação na Comunidade gerou novas respostas. Clique para conferir.',
  },
  {
    key: 'comunidade.resposta',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Resposta na Comunidade',
    body: 'Responderam ao seu comentário na Comunidade de pais do Paternar!',
  },

  // --------------------------------------------------------------------------
  // 3. Categoria Boletim e Conquistas
  // --------------------------------------------------------------------------
  // boletim.conquista
  {
    key: 'boletim.conquista',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Nova conquista registrada!',
    body: 'Você registrou uma nova conquista para {{childName}}: "{{title}}".',
  },
  {
    key: 'boletim.conquista',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Nova conquista!',
    body: 'Parabéns! Nova conquista registrada para {{childName}} no Boletim.',
  },
  {
    key: 'boletim.conquista',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Novo marco registrado para {{childName}} no Paternar',
    body: 'Uma nova conquista foi registrada para {{childName}}: "{{title}}". Cada passo conta no desenvolvimento!',
  },
  {
    key: 'boletim.conquista',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Nova conquista registrada',
    body: 'Parabéns! Nova conquista de *{{childName}}* registrada no Boletim: "{{title}}".',
  },
  // Alias boletim_conquista
  {
    key: 'boletim_conquista',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Nova conquista registrada!',
    body: 'Você registrou uma nova conquista para {{childName}}: "{{title}}".',
  },
  {
    key: 'boletim_conquista',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Nova conquista!',
    body: 'Parabéns! Nova conquista registrada para {{childName}} no Boletim.',
  },

  // boletim.insight_semanal
  {
    key: 'boletim.insight_semanal',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Dica da semana para você e seus filhos',
    body: '{{title}}: {{summary}}',
  },
  {
    key: 'boletim.insight_semanal',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Dica da semana do Paternar',
    body: '{{title}}. Toque para conferir a dica para a faixa etária dos seus filhos!',
  },
  {
    key: 'boletim.insight_semanal',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Boletim semanal Paternar: {{title}}',
    body: 'Olá! Confira o resumo da semana e a dica personalizada para seus filhos: {{title}}. {{summary}}',
  },
  {
    key: 'boletim.insight_semanal',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Dica da semana',
    body: 'Dica da semana no Paternar para você e seus filhos: *{{title}}*. {{summary}}',
  },
  // Alias insight_semanal
  {
    key: 'insight_semanal',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Dica da semana para você e seus filhos',
    body: '{{title}}: {{summary}}',
  },
  {
    key: 'insight_semanal',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Dica da semana do Paternar',
    body: '{{title}}. Toque para conferir a dica para a faixa etária dos seus filhos!',
  },

  // --------------------------------------------------------------------------
  // 4. Categoria Avisos da Plataforma
  // --------------------------------------------------------------------------
  // avisos.boas_vindas
  {
    key: 'avisos.boas_vindas',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Bem-vindo ao Paternar!',
    body: 'Estamos muito felizes em ter você aqui. Explore a Agenda, cadastre seus filhos e aproveite conteúdos exclusivos.',
  },
  {
    key: 'avisos.boas_vindas',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Bem-vindo ao Paternar!',
    body: 'Sua jornada de paternidade ativa começa aqui. Toque para explorar o aplicativo!',
  },
  {
    key: 'avisos.boas_vindas',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Bem-vindo ao Paternar — Paternidade ativa e presente',
    body: 'Olá! Seja bem-vindo ao Paternar. Aqui você encontra ferramentas, dicas e uma comunidade pronta para apoiar sua paternidade.',
  },
  {
    key: 'avisos.boas_vindas',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Boas-vindas ao Paternar',
    body: 'Olá! Seja muito bem-vindo ao Paternar. Estamos juntos na jornada de uma paternidade ativa e presente!',
  },

  // avisos.plataforma
  {
    key: 'avisos.plataforma',
    channel: 'inbox',
    locale: 'pt-BR',
    subject: 'Comunicado importante do Paternar',
    body: 'Temos atualizações e avisos importantes na plataforma. Confira as novidades!',
  },
  {
    key: 'avisos.plataforma',
    channel: 'push',
    locale: 'pt-BR',
    subject: 'Aviso do Paternar',
    body: 'Novidades disponíveis no aplicativo. Toque para saber mais!',
  },
  {
    key: 'avisos.plataforma',
    channel: 'email',
    locale: 'pt-BR',
    subject: 'Comunicado da plataforma Paternar',
    body: 'Olá! Preparamos melhorias para tornar sua experiência ainda melhor. Acesse o aplicativo e confira.',
  },
  {
    key: 'avisos.plataforma',
    channel: 'whatsapp',
    locale: 'pt-BR',
    subject: 'Aviso da plataforma',
    body: 'Novidades no Paternar! Atualizamos recursos para ajudar no dia a dia com seus filhos.',
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
          gen_random_uuid(), ${companyId}::uuid, ${t.key}, ${t.channel}, ${t.locale}, 1, ${t.subject}, ${t.body}, true, now(), now()
        )
        ON CONFLICT (company_id, key, channel, locale, version) DO NOTHING;
      `);
      templatesCount++;
    } catch {
      // Ignora se tabela notification.templates ainda nao tiver sido criada por migration
    }
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
