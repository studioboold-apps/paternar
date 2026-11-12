/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { LlmProviderName, LlmTask } from '../ai.constant';

/** Uma linha por mes de trabalho; o modulo Ai nunca ve a tabela do outro. */
export type ActivityDigestRow = {
  /** O boletim cita a atividade pelo nome: elogio generico nao convence ninguem. */
  readonly title: string;
  readonly category: string | null;
  readonly isCompleted: boolean;
  readonly rating: number | null;
};

export type InsightDigestRow = {
  readonly category: string;
  readonly rating: number;
};

export type MonthDigestParams = {
  readonly userId: string;
  readonly month: string;
};

export type RecentActivitiesParams = {
  readonly userId: string;
  readonly limit: number;
};

export type ActivityDigestPort = {
  listMonth(params: MonthDigestParams): Promise<readonly ActivityDigestRow[]>;
  /** As ultimas atividades, da mais nova para a mais antiga: base do "nao repetir". */
  listRecent?(params: RecentActivitiesParams): Promise<readonly ActivityDigestRow[]>;
};

export type InsightDigestPort = {
  listMonth(params: MonthDigestParams): Promise<readonly InsightDigestRow[]>;
};

export type ChildContext = {
  /** So' para escolher o filho; nunca vai para o prompt. */
  readonly id?: string;
  readonly name: string;
  /** Idade em anos digitada no cadastro; vale quando nao ha data de nascimento. */
  readonly age: number;
  readonly gender: string;
  /**
   * `YYYY-MM-DD`. Nao viaja ao provedor: vira idade em meses no prompt, porque
   * "0 anos" nao diz nada sobre um bebe de 3 ou de 11 meses.
   */
  readonly birthDate?: string | null;
  readonly favoriteHobby?: string | null;
  readonly favoriteFood?: string | null;
  readonly favoriteMovieGenre?: string | null;
  readonly favoriteColor?: string | null;
};

/** O que o pai escolheu informar, com aceite do art. 11. `null` e' "prefiro nao dizer". */
export type FamilyValuesContext = {
  readonly religion: string | null;
  readonly politics: string | null;
  readonly orientation: string | null;
};

export type FamilyValuesPort = {
  findMine(userId: string): Promise<FamilyValuesContext>;
};

/** Cidade que o pai escreveu no perfil; base das sugestoes da regiao. */
export type ParentRegionPort = {
  findCity(userId: string): Promise<string | undefined>;
};

export type ChildrenContextPort = {
  listByUser(userId: string): Promise<readonly ChildContext[]>;
};

export type ActivitySummary = {
  readonly total: number;
  readonly completed: number;
  readonly completionRate: number;
  readonly averageRating: number | undefined;
  readonly countByCategory: ReadonlyMap<string, number>;
};

export type InsightSummary = {
  readonly ratedCount: number;
  readonly averageRating: number | undefined;
  readonly averageByCategory: ReadonlyMap<string, number>;
};

/** Uma fala ja dita na conversa, na ordem em que foi dita. */
export type LlmTurn = {
  readonly role: 'user' | 'assistant';
  readonly content: string;
};

/** Imagem que acompanha a pergunta atual; `data` e' base64 sem prefixo `data:`. */
export type LlmImage = {
  readonly mediaType: string;
  readonly data: string;
};

export type LlmTextRequest = {
  /** Qual agente pede: decide modelo e esforco (`LLM_TASK_PROFILES`). */
  readonly task: LlmTask;
  /** Quem pediu: so' para a conta de uso (`LlmUsage`); nunca viaja ao provedor. */
  readonly userId?: string | undefined;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  /** Falas anteriores da conversa, da mais antiga para a mais recente. */
  readonly history?: readonly LlmTurn[];
  /** Imagens da pergunta ATUAL; as de falas antigas nao viajam de novo. */
  readonly images?: readonly LlmImage[];
};

export type LlmStructuredRequest = LlmTextRequest & {
  /** Nome do formato pedido; os dois provedores exigem um. */
  readonly schemaName: string;
  readonly jsonSchema: Record<string, unknown>;
};

/**
 * O provedor devolve `unknown`: quem valida e o mesmo schema Zod que gerou o
 * JSON Schema pedido. Confiar na palavra do provedor foi como a Base44 servia
 * tela quebrada quando o modelo respondia fora do formato.
 */
export type LlmWebSearchRequest = {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  /** Cidade do pai, para a busca priorizar resultados de la'. */
  readonly city?: string | undefined;
  /** Quem pediu: so' para a conta de uso; nunca viaja ao provedor. */
  readonly userId?: string | undefined;
};

/**
 * Tokens que o PROVEDOR contou numa chamada. Sem pergunta nem resposta: e' o
 * que o painel soma para mostrar quanto a IA custa, por dia e por pai.
 */
export type LlmUsage = {
  readonly provider: string;
  readonly model: string;
  readonly task: string;
  readonly userId?: string | undefined;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly webSearches: number;
};

/** Quem recebe a conta. Nao pode lancar: a resposta ao pai nao depende dela. */
export type LlmUsageSink = (usage: LlmUsage) => void;

export type LlmProvider = {
  readonly name: LlmProviderName;
  generateText(request: LlmTextRequest): Promise<string>;
  generateStructured(request: LlmStructuredRequest): Promise<unknown>;
  /** Opcional: so' o provedor que tem busca na web implementa. */
  searchWeb?(request: LlmWebSearchRequest): Promise<string>;
};

export type ChatHistoryParams = {
  readonly userId: string;
  readonly conversationId: string;
  readonly limit: number;
};

/** Leitura estreita das ultimas falas; o modulo Ai nunca ve a tabela de mensagens. */
export type ChatHistoryPort = {
  listRecent(params: ChatHistoryParams): Promise<readonly LlmTurn[]>;
};

export type TranscriptionRequest = {
  readonly audio: Uint8Array;
  readonly format: { readonly contentType: string; readonly extension: string };
};

/** Voz vira texto. A Anthropic nao ouve audio, entao e' um provedor a parte. */
export type SpeechTranscriber = {
  transcribe(request: TranscriptionRequest): Promise<string>;
};

export type AiDependencies = {
  readonly provider: LlmProvider;
  readonly children: ChildrenContextPort;
  readonly chatHistory: ChatHistoryPort;
  readonly transcriber: SpeechTranscriber;
  readonly activities: ActivityDigestPort;
  readonly insights: InsightDigestPort;
  /** Opcional: sem ela, as sugestoes saem sem regiao, como antes. */
  readonly region?: ParentRegionPort;
  /** Opcional: sem ela, a IA responde sem os valores da familia, como antes. */
  readonly familyValues?: FamilyValuesPort;
};
