/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Semeia templates padrao do sistema na categoria de atividades caso ainda nao existam.
 */

import { sql } from 'drizzle-orm';
import type { Database } from '../../database/client';

export async function bootstrapNotificationTemplates(db: Database, companyId = 'entrelacos'): Promise<void> {
  const defaultTemplates = [
    {
      key: 'atividade_agendada',
      channel: 'inbox',
      locale: 'pt-BR',
      subject: 'Atividade agendada!',
      body: 'Você marcou a atividade "{{title}}" para {{activityDate}}.',
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
