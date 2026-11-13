/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';

import {
  createTestClient,
  readDataRecord,
  readErrorCode,
  type TestClient,
} from '../../testing/http-test.util';
import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_METHODS, HTTP_STATUS } from '../shared/http/http.constant';
import { createRateLimiter, type RateLimitPolicy } from '../shared/http/rate-limit';
import {
  ACTIVITY_SUGGESTIONS_PATH,
  AI_RATE_LIMIT,
  CHAT_PATH,
  CHAT_TRANSCRIPTION_PATH,
  INSIGHTS_PATH,
  REPORT_PATH,
} from './ai.constant';
import { buildAiRoutes, type BuildAiRoutesParams } from './ai.controller';
import { PlanChatLimitReachedError, PlanFeatureLockedError } from '../PlanLimits/plan-limits.error';
import { createLlmProvider } from './providers/provider.factory';
import { OFF_TOPIC_REPLY } from './ai.topic-guard';
import { createAiUseCases } from './ai.use-case';
import type {
  ActivityDigestRow,
  ChildContext,
  InsightDigestRow,
  LlmProvider,
  LlmStructuredRequest,
  LlmTextRequest,
  LlmTurn,
  SpeechTranscriber,
  TranscriptionRequest,
} from './types/ai.types';
import { createTranscriber } from './providers/transcription.provider';

const CHILD: ChildContext = { name: 'Bento', age: 7, gender: 'masculino' };
const MONTH = '2026-08';

type FakeProvider = LlmProvider & {
  readonly prompts: string[];
  readonly systemPrompts: string[];
  readonly textRequests: LlmTextRequest[];
};

function createFakeProvider(structured: unknown, text = 'Uma resposta do mentor.'): FakeProvider {
  const prompts: string[] = [];
  const systemPrompts: string[] = [];
  const textRequests: LlmTextRequest[] = [];
  return {
    name: 'anthropic',
    prompts,
    systemPrompts,
    textRequests,
    async generateText(request: LlmTextRequest): Promise<string> {
      prompts.push(request.userPrompt);
      systemPrompts.push(request.systemPrompt);
      textRequests.push(request);
      return text;
    },
    async generateStructured({ userPrompt, systemPrompt }: LlmStructuredRequest): Promise<unknown> {
      prompts.push(userPrompt);
      systemPrompts.push(systemPrompt);
      return structured;
    },
  };
}

type HarnessParams = {
  readonly provider: FakeProvider;
  readonly children?: readonly ChildContext[];
  readonly activities?: readonly ActivityDigestRow[];
  readonly insights?: readonly InsightDigestRow[];
  readonly history?: readonly LlmTurn[];
  readonly transcriber?: SpeechTranscriber;
  readonly policy?: RateLimitPolicy;
  readonly planGate?: BuildAiRoutesParams['planGate'];
};

function createHarness({
  provider,
  children = [CHILD],
  activities = [],
  insights = [],
  history = [],
  transcriber = createTranscriber({ apiKey: '', model: '' }),
  policy = AI_RATE_LIMIT,
  planGate,
}: HarnessParams): TestClient {
  const useCases = createAiUseCases({
    provider,
    children: { listByUser: async () => children },
    activities: { listMonth: async () => activities },
    insights: { listMonth: async () => insights },
    chatHistory: { listRecent: async ({ limit }) => history.slice(-limit) },
    transcriber,
  });
  return createTestClient({
    routes: buildAiRoutes({ useCases, rateLimiter: createRateLimiter(policy), planGate }),
  });
}

function buildInsightsPayload(): unknown {
  return {
    insights: [
      {
        title: 'Rotina de leitura',
        content: 'Leia dez minutos antes de dormir.',
        category: 'comportamento',
        childName: 'Bento',
      },
    ],
  };
}

function buildReportPayload(): unknown {
  return {
    grade: 7,
    strengths: [{ title: 'Presenca', description: 'Esteve junto nos fins de semana.' }],
    improvements: [{ title: 'Constancia', description: 'Faltou durante a semana.' }],
    motivationalMessage: 'Continue.',
    nextMonthGoal: 'Uma atividade por semana.',
  };
}

describe('rotas de IA', () => {
  test('insights voltam com id gerado pelo SERVIDOR', async () => {
    const provider = createFakeProvider(buildInsightsPayload());
    const client = createHarness({ provider });

    const response = await client.send({ method: HTTP_METHODS.POST, path: INSIGHTS_PATH, body: {} });

    expect(response.status).toBe(200);
    const [insight] = readDataRecord(response).insights as readonly Record<string, unknown>[];
    expect(insight?.title).toBe('Rotina de leitura');
    expect(typeof insight?.id).toBe('string');
    expect((insight?.id as string).length).toBeGreaterThan(0);
  });

  test('sem filho cadastrado NAO chama o provedor — a chamada custa dinheiro', async () => {
    const provider = createFakeProvider(buildInsightsPayload());
    const client = createHarness({ provider, children: [] });

    const response = await client.send({ method: HTTP_METHODS.POST, path: INSIGHTS_PATH, body: {} });

    expect(response.status).toBe(422);
    expect(readErrorCode(response)).toBe(ERROR_CODES.ai.NO_CHILDREN);
    expect(provider.prompts).toHaveLength(0);
  });

  test('a conversa dispensa filho cadastrado — a primeira pergunta vem antes', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider, children: [] });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'Como lidar com birra?' },
    });

    expect(response.status).toBe(200);
    expect(readDataRecord(response).reply).toBe('Uma resposta do mentor.');
    expect(provider.prompts[0]).toContain('Como lidar com birra?');
  });

  test('pergunta fora do tema volta com resposta pronta e nao chama a IA paga', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider, children: [] });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'Qual ação da bolsa de valores eu compro hoje?' },
    });

    expect(response.status).toBe(200);
    expect(readDataRecord(response).reply).toBe(OFF_TOPIC_REPLY);
    expect(provider.textRequests).toHaveLength(0);
  });

  test('o boletim usa os numeros do SERVIDOR, nao o que o cliente mandar', async () => {
    const provider = createFakeProvider(buildReportPayload());
    const client = createHarness({
      provider,
      activities: [
        { title: 'Trilha no parque', category: 'aventura', isCompleted: true, rating: 5 },
        { title: 'Acampar na sala', category: 'aventura', isCompleted: true, rating: 3 },
        { title: 'Lição de frações', category: 'escolar', isCompleted: false, rating: null },
        { title: 'Sem categoria', category: null, isCompleted: false, rating: null },
      ],
      insights: [{ category: 'comportamento', rating: 4 }],
    });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: REPORT_PATH,
      // `completionRate` e `grade` sao ruido do cliente: o schema os descarta.
      body: { month: MONTH, completionRate: 100, grade: 10 },
    });

    expect(response.status).toBe(200);
    // A regua do servidor da' 4,0 (presenca 1,25 + constancia 1 + variedade 1 +
    // satisfacao 0,75); o 7 que o modelo falso devolve e' descartado.
    expect(readDataRecord(response).grade).toBe(4);
    expect(provider.prompts[0]).toContain('nota do mês: 4,0');
    expect(provider.prompts[0]).toContain('- Trilha no parque (aventura, feita, nota 5/5)');
    expect(provider.prompts[0]).toContain('atividades planejadas: 4');
    expect(provider.prompts[0]).toContain('taxa de conclusão: 50%');
  });

  test('mes fora de YYYY-MM para na fronteira, antes de gastar a chamada', async () => {
    const provider = createFakeProvider(buildReportPayload());
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: REPORT_PATH,
      body: { month: 'agosto' },
    });

    expect(response.status).toBe(400);
    expect(provider.prompts).toHaveLength(0);
  });

  test('resposta fora do formato e culpa do PROVEDOR: 502, nao 400', async () => {
    const provider = createFakeProvider({ insights: [{ title: 'so o titulo' }] });
    const client = createHarness({ provider });

    const response = await client.send({ method: HTTP_METHODS.POST, path: INSIGHTS_PATH, body: {} });

    expect(response.status).toBe(502);
    expect(readErrorCode(response)).toBe(ERROR_CODES.ai.RESPONSE_INVALID);
  });

  test('sugestao para UM filho: so ele entra no prompt', async () => {
    const provider = createFakeProvider({ suggestions: [] });
    const luisa = { id: '11111111-1111-4111-8111-111111111111', name: 'Luisa', age: 3, gender: 'feminino' };
    const maria = { id: '22222222-2222-4222-8222-222222222222', name: 'Maria', age: 9, gender: 'feminino' };
    const client = createHarness({ provider, children: [luisa, maria] });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: ACTIVITY_SUGGESTIONS_PATH,
      body: { childId: maria.id },
    });

    expect(response.status).toBe(200);
    expect(provider.prompts[0]).toContain('Maria');
    expect(provider.prompts[0]).not.toContain('Luisa');
  });

  test('sugestao para filho que nao e do pai: 404 e nenhuma chamada a IA', async () => {
    const provider = createFakeProvider({ suggestions: [] });
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: ACTIVITY_SUGGESTIONS_PATH,
      body: { childId: '33333333-3333-4333-8333-333333333333' },
    });

    expect(response.status).toBe(404);
    expect(provider.prompts).toHaveLength(0);
  });

  test('com cidade, a busca na web entra no prompt das sugestoes', async () => {
    const provider = createFakeProvider({ suggestions: [] });
    const searches: string[] = [];
    const searching = {
      ...provider,
      async searchWeb({ userPrompt }: { userPrompt: string }) {
        searches.push(userPrompt);
        return 'Teatro infantil no Sesc Franca, sábado 15h';
      },
    };
    const useCases = createAiUseCases({
      provider: searching,
      children: { listByUser: async () => [CHILD] },
      activities: { listMonth: async () => [] },
      insights: { listMonth: async () => [] },
      chatHistory: { listRecent: async () => [] },
      transcriber: createTranscriber({ apiKey: '', model: '' }),
      region: { findCity: async () => 'Franca, SP' },
    });

    await useCases.suggestActivities({ userId: 'u', values: { locale: 'pt-BR' } });

    expect(searches[0]).toContain('Franca, SP');
    expect(provider.prompts[0]).toContain('Teatro infantil no Sesc Franca');
  });

  test('busca na web que falha nao derruba a sugestao', async () => {
    const provider = createFakeProvider({ suggestions: [] });
    const useCases = createAiUseCases({
      provider: {
        ...provider,
        async searchWeb() {
          throw new Error('busca fora do ar');
        },
      },
      children: { listByUser: async () => [CHILD] },
      activities: { listMonth: async () => [] },
      insights: { listMonth: async () => [] },
      chatHistory: { listRecent: async () => [] },
      transcriber: createTranscriber({ apiKey: '', model: '' }),
      region: { findCity: async () => 'Franca, SP' },
    });

    expect(await useCases.suggestActivities({ userId: 'u', values: { locale: 'pt-BR' } })).toEqual([]);
    expect(provider.prompts[0]).toContain('Franca, SP');
  });

  test('estourar o teto devolve 429 COM Retry-After', async () => {
    const provider = createFakeProvider({ suggestions: [] });
    const client = createHarness({ provider, policy: { maxRequests: 2, windowSeconds: 60 } });
    const send = () =>
      client.send({ method: HTTP_METHODS.POST, path: ACTIVITY_SUGGESTIONS_PATH, body: {} });

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    const blocked = await send();

    expect(blocked.status).toBe(429);
    expect(readErrorCode(blocked)).toBe(ERROR_CODES.shared.TOO_MANY_REQUESTS);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  test('o teto e por USUARIO: as quatro rotas dividem a mesma cota', async () => {
    const provider = createFakeProvider(buildInsightsPayload());
    const client = createHarness({ provider, policy: { maxRequests: 1, windowSeconds: 60 } });

    expect(
      (await client.send({ method: HTTP_METHODS.POST, path: INSIGHTS_PATH, body: {} })).status,
    ).toBe(200);
    expect(
      (await client.send({ method: HTTP_METHODS.POST, path: CHAT_PATH, body: { message: 'oi' } }))
        .status,
    ).toBe(429);
  });
});

/** 1x1 JPEG minimo: so' a marca do comeco importa para a checagem de tipo. */
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString(
  'base64',
);
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64');

describe('memoria da conversa', () => {
  const HISTORY: readonly LlmTurn[] = [
    { role: 'user', content: 'Meu filho Bento tem medo do escuro.' },
    { role: 'assistant', content: 'Uma luz fraca no quarto ajuda.' },
    // A pergunta atual: o app grava ANTES de chamar a IA.
    { role: 'user', content: 'E se ele acordar de madrugada?' },
  ];

  test('as falas anteriores viajam com a pergunta, sem repetir a atual', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider, history: HISTORY });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'E se ele acordar de madrugada?' },
    });

    expect(response.status).toBe(200);
    const [request] = provider.textRequests;
    expect(request?.history).toEqual(HISTORY.slice(0, 2));
    expect(request?.userPrompt).toContain('E se ele acordar de madrugada?');
  });

  test('perguntas antigas que ficaram sem resposta nao voltam', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({
      provider,
      history: [...HISTORY.slice(0, 2), { role: 'user', content: 'pergunta que falhou' }, HISTORY[2]!],
    });

    await client.send({ method: HTTP_METHODS.POST, path: CHAT_PATH, body: { message: 'oi' } });

    expect(provider.textRequests[0]?.history).toEqual(HISTORY.slice(0, 2));
  });
});

describe('foto no chat', () => {
  test('a foto chega ao provedor junto da pergunta', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'O que acha deste desenho?', images: [{ mediaType: 'image/jpeg', data: JPEG_BASE64 }] },
    });

    expect(response.status).toBe(200);
    expect(provider.textRequests[0]?.images).toEqual([{ mediaType: 'image/jpeg', data: JPEG_BASE64 }]);
    expect(provider.prompts[0]).toContain('enviou uma foto');
  });

  test('so a foto, sem texto, tambem vale', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { images: [{ mediaType: 'image/png', data: PNG_BASE64 }] },
    });

    expect(response.status).toBe(200);
    expect(provider.prompts[0]).toContain('mandou só a foto');
  });

  test('sem texto e sem foto para na fronteira', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    const response = await client.send({ method: HTTP_METHODS.POST, path: CHAT_PATH, body: { message: '  ' } });

    expect(response.status).toBe(400);
    expect(provider.prompts).toHaveLength(0);
  });

  test('tipo declarado que nao bate com os bytes nao gasta a chamada', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'oi', images: [{ mediaType: 'image/jpeg', data: PNG_BASE64 }] },
    });

    expect(response.status).toBe(400);
    expect(provider.prompts).toHaveLength(0);
  });
});

describe('audio no chat', () => {
  /** Inicio de um WebM, que e' o que o Chrome e o Android gravam. */
  const WEBM_BYTES = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);

  function createFakeTranscriber(): SpeechTranscriber & { readonly calls: TranscriptionRequest[] } {
    const calls: TranscriptionRequest[] = [];
    return {
      calls,
      async transcribe(request) {
        calls.push(request);
        return 'Como faco ele dormir cedo?';
      },
    };
  }

  function sendAudio(client: TestClient, bytes: Uint8Array) {
    const form = new FormData();
    form.append('audio', new Blob([bytes], { type: 'audio/webm' }), 'gravacao.webm');
    return client.send({ method: HTTP_METHODS.POST, path: CHAT_TRANSCRIPTION_PATH, body: form });
  }

  test('a voz volta como texto, com o formato decidido pelos bytes', async () => {
    const transcriber = createFakeTranscriber();
    const client = createHarness({ provider: createFakeProvider(undefined), transcriber });

    const response = await sendAudio(client, WEBM_BYTES);

    expect(response.status).toBe(200);
    expect(readDataRecord(response).text).toBe('Como faco ele dormir cedo?');
    expect(transcriber.calls[0]?.format.extension).toBe('webm');
  });

  test('arquivo que nao e audio nao chega ao provedor', async () => {
    const transcriber = createFakeTranscriber();
    const client = createHarness({ provider: createFakeProvider(undefined), transcriber });

    const response = await sendAudio(client, new TextEncoder().encode('<script>'));

    expect(response.status).toBe(400);
    expect(readErrorCode(response)).toBe(ERROR_CODES.ai.AUDIO_INVALID);
    expect(transcriber.calls).toHaveLength(0);
  });

  test('sem chave de transcricao, so o microfone responde 503', async () => {
    const client = createHarness({ provider: createFakeProvider(undefined) });

    const response = await sendAudio(client, WEBM_BYTES);

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(readErrorCode(response)).toBe(ERROR_CODES.ai.TRANSCRIPTION_NOT_CONFIGURED);
  });
});

/**
 * `F2.4` cobra a tela de chat provando o ERRO legivel quando nao ha chave de IA.
 * Isso so existe se o produto SUBIR sem ela — e foi o que faltava: em 05/09/2026
 * `make dev` levantou a web e matou a API com `ZodError: LLM_API_KEY`.
 */
describe('IA sem chave configurada', () => {
  function createUnconfiguredClient(): TestClient {
    const useCases = createAiUseCases({
      provider: createLlmProvider({ providerName: 'anthropic', apiKey: '', model: '' }),
      children: { listByUser: async () => [CHILD] },
      activities: { listMonth: async () => [] },
      insights: { listMonth: async () => [] },
      chatHistory: { listRecent: async () => [] },
      transcriber: createTranscriber({ apiKey: '', model: '' }),
    });
    return createTestClient({
      routes: buildAiRoutes({ useCases, rateLimiter: createRateLimiter(AI_RATE_LIMIT) }),
    });
  }

  test.each([
    [CHAT_PATH, { message: 'oi' }],
    [INSIGHTS_PATH, {}],
    [ACTIVITY_SUGGESTIONS_PATH, {}],
    [REPORT_PATH, { month: MONTH }],
  ])('%s responde 503 com codigo estavel', async (path, body) => {
    const response = await createUnconfiguredClient().send({
      method: HTTP_METHODS.POST,
      path,
      body,
    });

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(readErrorCode(response)).toBe(ERROR_CODES.ai.NOT_CONFIGURED);
  });
});

/**
 * A resposta da IA tem de falar a lingua que o pai escolheu no app: um insight em
 * portugues no meio de uma tela em ingles e' texto que ele nao le.
 */
describe('a IA responde no idioma do app', () => {
  test('o chat em ingles pede resposta em ingles', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'How do I handle tantrums?', locale: 'en' },
    });

    expect(response.status).toBe(200);
    expect(provider.systemPrompts[0]).toContain('Responda sempre em ingles');
  });

  test('os insights em espanhol pedem resposta em espanhol', async () => {
    const provider = createFakeProvider(buildInsightsPayload());
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: INSIGHTS_PATH,
      body: { locale: 'es' },
    });

    expect(response.status).toBe(200);
    expect(provider.systemPrompts[0]).toContain('Responda sempre em espanhol');
  });

  /** O app antigo nao manda o campo: continua recebendo resposta, em portugues. */
  test('sem idioma, portugues', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      body: { message: 'Oi' },
    });

    expect(response.status).toBe(200);
    expect(provider.systemPrompts[0]).toContain('Responda sempre em portugues do Brasil');
  });

  test('idioma desconhecido cai no portugues em vez de recusar', async () => {
    const provider = createFakeProvider(buildReportPayload());
    const client = createHarness({ provider });

    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: REPORT_PATH,
      body: { month: MONTH, locale: 'fr' },
    });

    expect(response.status).toBe(200);
    expect(provider.systemPrompts[0]).toContain('Responda sempre em portugues do Brasil');
  });

  /** A categoria e' identificador do banco: traduzida, a resposta nao passa no schema. */
  test('o prompt manda manter a categoria como identificador', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider });

    await client.send({ method: HTTP_METHODS.POST, path: CHAT_PATH, body: { message: 'Hi', locale: 'en' } });

    expect(provider.systemPrompts[0]).toContain('sem traduzir');
  });
});

describe('limites do plano (chave ligada)', () => {
  const freePlan = (overrides: { readonly chatLimitReached?: boolean } = {}): BuildAiRoutesParams['planGate'] => ({
    async assertCanChat({ hasImages }) {
      if (hasImages) throw new PlanFeatureLockedError({ lock: 'chat_media', level: 'free' });
      if (overrides.chatLimitReached) {
        throw new PlanChatLimitReachedError({ limit: 10, resetsAt: new Date('2026-11-20T00:00:00Z') });
      }
    },
    async assertCanUseAudio() {
      throw new PlanFeatureLockedError({ lock: 'chat_media', level: 'free' });
    },
    hasFullReports: async () => false,
  });

  test('passou do limite: 402 com o codigo do plano, e a IA paga nao e chamada', async () => {
    const provider = createFakeProvider(undefined);
    const client = createHarness({ provider, planGate: freePlan({ chatLimitReached: true }) });

    const response = await client.send({ method: HTTP_METHODS.POST, path: CHAT_PATH, body: { message: 'Como lidar com birra?' } });

    expect(response.status).toBe(402);
    expect(readErrorCode(response)).toBe(ERROR_CODES.plan.CHAT_LIMIT_REACHED);
    expect(provider.prompts).toHaveLength(0);
  });

  test('o Boletim do gratuito vem com a nota e a mensagem, e o resto trancado', async () => {
    const provider = createFakeProvider(buildReportPayload());
    const client = createHarness({ provider, planGate: freePlan() });

    const response = await client.send({ method: HTTP_METHODS.POST, path: REPORT_PATH, body: { month: MONTH } });

    expect(response.status).toBe(200);
    const report = readDataRecord(response);
    expect(report.motivational_message ?? report.motivationalMessage).toBe('Continue.');
    expect(report.strengths).toEqual([]);
    expect(report.locked).toBe(true);
  });

  test('o audio do gratuito e recusado antes de ler o arquivo', async () => {
    const client = createHarness({ provider: createFakeProvider(undefined), planGate: freePlan() });
    const response = await client.send({ method: HTTP_METHODS.POST, path: CHAT_TRANSCRIPTION_PATH, body: {} });
    expect(response.status).toBe(402);
    expect(readErrorCode(response)).toBe(ERROR_CODES.plan.FEATURE_LOCKED);
  });
});
