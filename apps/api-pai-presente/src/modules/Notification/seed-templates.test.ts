/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, it } from 'bun:test';

import { renderTemplate } from '@adatechnology/notification-contracts';

import { DEFAULT_NOTIFICATION_TEMPLATES, SEED_TEMPLATE_VERSION } from './seed-templates';
import { TEMPLATE_EXAMPLE_VALUES } from './template-variables';

function render(template: (typeof DEFAULT_NOTIFICATION_TEMPLATES)[number]) {
  return renderTemplate({
    channel: template.channel,
    subject: template.subject,
    body: template.body,
    payload: TEMPLATE_EXAMPLE_VALUES,
  });
}

describe('modelos padrao de notificacao', () => {
  it('cabem nos limites de cada canal com os valores de exemplo', () => {
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
      const rendered = render(template);
      const exceeded = rendered.constraints.filter((check) => check.exceeded);
      expect({ key: template.key, channel: template.channel, exceeded }).toEqual({
        key: template.key,
        channel: template.channel,
        exceeded: [],
      });
    }
  });

  it('nao sobra placeholder sem valor', () => {
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
      const rendered = render(template);
      expect(`${rendered.title}\n${rendered.body}`).not.toContain('{{');
    }
  });

  it('negrito com * so no WhatsApp: nos outros canais o asterisco apareceria cru', () => {
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES.filter((t) => t.channel !== 'whatsapp')) {
      expect(`${template.subject}${template.body}`).not.toContain('*');
    }
  });

  it('e-mail sem tag HTML: o SDK escapa o corpo e a tag sairia como texto', () => {
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES.filter((t) => t.channel === 'email')) {
      expect(template.body).not.toMatch(/<[a-z/][^>]*>/i);
    }
  });

  it('a versao dos textos novos passa da primeira, para publicar sem sobrescrever edicoes', () => {
    expect(SEED_TEMPLATE_VERSION).toBeGreaterThan(1);
  });
});
