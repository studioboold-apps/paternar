/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Semeia templates padrao do sistema nas categorias de atividades, comunidade e boletim.
 */

import { sql } from 'drizzle-orm';
import type { Database } from '../../database/client';

export async function bootstrapNotificationTemplates(db: Database, companyId = 'entrelacos'): Promise<void> {
  const defaultTemplates = [
    // 1. Categoria Atividades (Agenda / Juntinhos)
    {
      key: 'atividade_agendada',
      channel: 'inbox',
      locale: 'pt-BR',
      subject: 'Atividade agendada!',
      body: 'Você marcou a atividade "{{title}}" para {{activityDate}}.',
    },
    {
      key: 'atividade_agendada',
      channel: 'push',
      locale: 'pt-BR',
      subject: 'Momento agendado!',
      body: 'Você marcou: "{{title}}" para {{activityDate}}.',
    },
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
      body: 'Você concluiu "{{title}}"! O tempo de qualidade faz a diferença no crescimento dos seus filhos.',
    },
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

    // 2. Categoria Comunidade
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

    // 3. Categoria Boletim e Marcos de Desenvolvimento
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
  ];

  for (const t of defaultTemplates) {
    try {
      await db.execute(sql`
        INSERT INTO notification.templates (
          id, company_id, key, channel, locale, version, subject, body, active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${companyId}, ${t.key}, ${t.channel}, ${t.locale}, 1, ${t.subject}, ${t.body}, true, now(), now()
        )
        ON CONFLICT (company_id, key, channel, locale, version) DO NOTHING;
      `);
    } catch {
      // Ignora erro se tabela notification.templates ainda nao tiver sido criada por migration
    }
  }
}
