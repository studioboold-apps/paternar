/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

/**
 * Filtro de tema do chat, ANTES da IA: pergunta claramente fora do objetivo do
 * app (codigo, bolsa, aposta, politica, curriculo...) volta com uma resposta
 * pronta e nao gasta chamada paga.
 *
 * Erra para o lado de deixar passar: se a pergunta fala de filho, familia,
 * escola ou cita o nome de um filho cadastrado, ela segue para a IA mesmo com
 * palavra suspeita ("como ensinar meu filho a programar?", "investir para a
 * faculdade da Maria"). O que escapar daqui ainda esbarra na regra de tema do
 * prompt do mentor.
 */

export const OFF_TOPIC_REPLY =
  'Sou o mentor do Paternar e só consigo ajudar com paternidade, família e crianças. ' +
  'Tem alguma dúvida sobre seus filhos ou sobre a rotina de vocês? Estou aqui para isso.';

/** Sinais de que a pergunta e' do tema: com qualquer um deles, a IA responde. */
const FAMILY_PATTERN = new RegExp(
  '\\b(' +
    [
      'filh\\w*',
      'crianc\\w*',
      'bebe\\w*',
      'nenem',
      'menin[oa]s?',
      'garot[oa]s?',
      'adolescen\\w*',
      'famili\\w*',
      'paternidade',
      'pai',
      'pais',
      'mae',
      'maes',
      'esposa',
      'marido',
      'escola\\w*',
      'creche',
      'birra\\w*',
      'brinca\\w*',
      'enteado\\w*',
      'enteada\\w*',
      'sobrinh\\w*',
      'neto\\w*',
    ].join('|') +
    ')\\b',
  'u',
);

/** Assuntos fora do objetivo do app. So' contam quando nao ha sinal de familia. */
const OFF_TOPIC_PATTERN = new RegExp(
  '\\b(' +
    [
      // programacao e ferramentas de trabalho
      'programacao',
      'programar',
      'codigo',
      'python',
      'javascript',
      'typescript',
      'java',
      'sql',
      'html',
      'css',
      'debug\\w*',
      'excel',
      'planilha\\w*',
      // mercado financeiro
      'bolsa de valores',
      'acoes da bolsa',
      'acao para comprar',
      'bitcoin',
      'cripto\\w*',
      'day ?trade\\w*',
      'forex',
      'tesouro direto',
      // apostas
      'aposta\\w*',
      'cassino\\w*',
      'loteria\\w*',
      'mega ?sena',
      // politica
      'eleica\\w*',
      'eleitor\\w*',
      'candidat\\w*',
      'partido politico',
      'deputad\\w*',
      'senador\\w*',
      // tarefas de escritorio e academicas do adulto
      'curriculo',
      'carta de apresentacao',
      'tcc',
      'monografia',
      'artigo cientifico',
      'traduz\\w*',
      'traducao',
      // tentativa de mudar as regras do mentor
      'ignore (as |todas as )?(suas )?instrucoes',
      'prompt do sistema',
      'system prompt',
    ].join('|') +
    ')\\b',
  'u',
);

/** Minusculas e sem acento: "Ações", "acoes" e "AÇÕES" caem na mesma regra. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export type TopicGuardParams = {
  readonly message: string;
  /** Nomes dos filhos cadastrados: cita-los ja' poe a pergunta no tema. */
  readonly childNames?: readonly string[];
};

export function isOffTopic({ message, childNames = [] }: TopicGuardParams): boolean {
  const text = normalize(message);
  if (text.trim().length === 0) return false;
  if (FAMILY_PATTERN.test(text)) return false;
  const words = new Set(text.split(/[^\p{L}]+/u));
  if (childNames.some((name) => words.has(normalize(name).split(/\s+/)[0] ?? ''))) return false;
  return OFF_TOPIC_PATTERN.test(text);
}
