/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Catalogo de variaveis por modelo: alimenta o preview e a lista "inserir
 * variavel" do editor no painel, e o SDK recusa salvar texto com variavel que
 * o app nunca envia (ela sairia vazia para o pai).
 */

import {
  extractTemplatePlaceholders,
  type TemplateVariableCatalog,
  type TemplateVariableDefinition,
} from '@adatechnology/notification-contracts';

import { DEFAULT_NOTIFICATION_TEMPLATES, type SeedTemplateItem } from './seed-templates';

/** Exemplo de cada variavel que os modelos usam: e' o que aparece no preview e no teste. */
export const TEMPLATE_EXAMPLE_VALUES: Readonly<Record<string, string>> = Object.freeze({
  title: 'Piquenique no parque',
  description: 'Levar a bola e a toalha xadrez.',
  activityDate: '15/11/2026',
  activityTime: ' às 10:00',
  childName: 'Miguel',
  commentText: 'Que ideia boa! Vou fazer com a minha filha.',
  summary: 'Vocês fizeram 3 atividades juntos esta semana.',
});

/**
 * As variaveis de cada chave sao as que os modelos padrao daquela chave usam,
 * em qualquer canal: o catalogo nasce do mesmo lugar que a semente, e os dois
 * nao se desencontram.
 */
export function buildTemplateVariableCatalog(
  templates: readonly SeedTemplateItem[] = DEFAULT_NOTIFICATION_TEMPLATES,
): TemplateVariableCatalog {
  const namesByKey = new Map<string, Set<string>>();
  for (const template of templates) {
    const names = namesByKey.get(template.key) ?? new Set<string>();
    for (const name of extractTemplatePlaceholders(`${template.subject}\n${template.body}`)) names.add(name);
    namesByKey.set(template.key, names);
  }

  return Object.fromEntries(
    [...namesByKey].map(([key, names]) => [
      key,
      [...names].map(
        (name): TemplateVariableDefinition => ({
          name,
          example: TEMPLATE_EXAMPLE_VALUES[name] ?? `(${name})`,
          required: false,
        }),
      ),
    ]),
  );
}
