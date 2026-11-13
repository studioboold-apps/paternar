/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { CONTENT_LENGTH_HEADER, HTTP_METHODS } from '../shared/http/http.constant';
import type { RateLimiter } from '../shared/http/rate-limit';
import { parseJsonBody } from '../shared/http/request.util';
import { respondWithData } from '../shared/http/response.util';
import type { RouteDefinition } from '../shared/http/route.types';
import {
  ACTIVITY_SUGGESTIONS_PATH,
  CHAT_AUDIO_FORM_FIELD,
  CHAT_AUDIO_MAX_BYTES,
  CHAT_PATH,
  CHAT_TRANSCRIPTION_PATH,
  INSIGHTS_PATH,
  REPORT_PATH,
} from './ai.constant';
import {
  chatBodySchema,
  generateInsightsBodySchema,
  generateReportBodySchema,
  generateSuggestionsBodySchema,
} from './ai.schema';
import { AudioInvalidError, AudioTooLargeError } from './ai.error';
import type { AiUseCases } from './ai.use-case';
import { trimInsights, trimReport, type PlanGate } from '../PlanLimits/plan-limits.gate';

const BYTES_PER_MEGABYTE = 1024 * 1024;
/** A moldura do multipart soma bytes ao corpo; a folga evita recusar audio no limite. */
const MULTIPART_ALLOWANCE_BYTES = 64 * 1024;

function audioTooLarge(): AudioTooLargeError {
  return new AudioTooLargeError(CHAT_AUDIO_MAX_BYTES / BYTES_PER_MEGABYTE);
}

/**
 * O cabecalho e' do cliente, entao ele nao decide nada: so' evita ler dez
 * minutos de audio para recusa-los depois. Quem decide e' o tamanho lido.
 */
async function readAudio(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get(CONTENT_LENGTH_HEADER));
  if (Number.isFinite(declared) && declared > CHAT_AUDIO_MAX_BYTES + MULTIPART_ALLOWANCE_BYTES) {
    throw audioTooLarge();
  }

  const form = await request.formData().catch(() => {
    throw new AudioInvalidError();
  });
  const file = form.get(CHAT_AUDIO_FORM_FIELD);
  if (file === null || typeof file === 'string') throw new AudioInvalidError();
  if (file.size > CHAT_AUDIO_MAX_BYTES) throw audioTooLarge();
  return new Uint8Array(await file.arrayBuffer());
}

export type BuildAiRoutesParams = {
  readonly useCases: AiUseCases;
  readonly rateLimiter: RateLimiter;
  /** Limites do plano. Ausente, nada e' limitado. */
  readonly planGate?: Pick<PlanGate, 'assertCanChat' | 'assertCanUseAudio' | 'hasFullReports'> | undefined;
  /** Conta da transcricao: o provedor nao devolve uso, entao a conta sai do tamanho do audio. */
  readonly recordTranscription?: ((params: { readonly userId: string; readonly bytes: number }) => void) | undefined;
};

/**
 * Toda rota daqui gasta dinheiro com terceiro, entao o teto vem ANTES do corpo
 * ser lido: conta invadida sem teto gasta sozinha (security.md §3). A chave e o
 * usuario autenticado, nunca o IP — um predio inteiro sai do mesmo IP.
 */
export function buildAiRoutes({
  useCases,
  rateLimiter,
  planGate,
  recordTranscription,
}: BuildAiRoutesParams): readonly RouteDefinition[] {
  return [
    {
      method: HTTP_METHODS.POST,
      path: INSIGHTS_PATH,
      summary: 'Gera insights de paternidade para os filhos do usuario.',
      handle: async ({ request, authenticatedUser }) => {
        rateLimiter.consume(authenticatedUser.userId);
        const values = await parseJsonBody(request, generateInsightsBodySchema);
        const insights = await useCases.generateInsights({
          userId: authenticatedUser.userId,
          values,
        });
        const full = (await planGate?.hasFullReports(authenticatedUser.userId)) ?? true;
        return respondWithData(trimInsights(insights, full));
      },
    },
    {
      method: HTTP_METHODS.POST,
      path: ACTIVITY_SUGGESTIONS_PATH,
      summary: 'Sugere atividades para o pai fazer com os filhos no mes.',
      handle: async ({ request, authenticatedUser }) => {
        rateLimiter.consume(authenticatedUser.userId);
        const values = await parseJsonBody(request, generateSuggestionsBodySchema);
        const suggestions = await useCases.suggestActivities({
          userId: authenticatedUser.userId,
          values,
        });
        return respondWithData({ suggestions });
      },
    },
    {
      method: HTTP_METHODS.POST,
      path: REPORT_PATH,
      summary: 'Monta o boletim do mes a partir dos numeros medidos pelo servidor.',
      handle: async ({ request, authenticatedUser }) => {
        rateLimiter.consume(authenticatedUser.userId);
        const values = await parseJsonBody(request, generateReportBodySchema);
        const report = await useCases.generateReport({ userId: authenticatedUser.userId, values });
        const full = (await planGate?.hasFullReports(authenticatedUser.userId)) ?? true;
        return respondWithData(trimReport(report, full));
      },
    },
    {
      method: HTTP_METHODS.POST,
      path: CHAT_PATH,
      summary: 'Responde a pergunta do pai como mentor de paternidade.',
      handle: async ({ request, authenticatedUser }) => {
        rateLimiter.consume(authenticatedUser.userId);
        const values = await parseJsonBody(request, chatBodySchema);
        await planGate?.assertCanChat({ userId: authenticatedUser.userId, hasImages: values.images.length > 0 });
        const answer = await useCases.chat({ userId: authenticatedUser.userId, values });
        return respondWithData(answer);
      },
    },
    {
      method: HTTP_METHODS.POST,
      path: CHAT_TRANSCRIPTION_PATH,
      summary: 'Transcreve o audio gravado pelo pai; o audio nao e guardado.',
      handle: async ({ request, authenticatedUser }) => {
        rateLimiter.consume(authenticatedUser.userId);
        await planGate?.assertCanUseAudio(authenticatedUser.userId);
        const audio = await readAudio(request);
        const transcription = await useCases.transcribe({ audio });
        recordTranscription?.({ userId: authenticatedUser.userId, bytes: audio.byteLength });
        return respondWithData(transcription);
      },
    },
  ];
}
