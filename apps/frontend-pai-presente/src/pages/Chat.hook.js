/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import {
  appendTranscript,
  isVoiceRecordingSupported,
  prepareChatImage,
  startVoiceRecording,
  toStoredContent,
  VOICE_MAX_SECONDS,
} from '@/lib/chat-attachments';
import { toConversationId, toScreenMessages } from '@/lib/chat-history';
import { describeApiFailure } from '@/lib/api-error-message';
import { useTranslation } from '@/lib/i18n';
import { chatRemaining, planBlockOf, PLAN_LOCKS, PLAN_STATUS_QUERY_KEY, usePlanStatus } from '@/lib/use-plan';

const CHAT_HISTORY_QUERY_KEY = 'chat-messages';

/** As perguntas prontas sao CHAVES; o texto delas mora no `*.locale.json`. */
export const SUGGESTED_QUESTION_KEYS = Object.freeze([
  'chat.suggestions.positiveReinforcement',
  'chat.suggestions.tantrums',
  'chat.suggestions.money',
  'chat.suggestions.weekend',
]);

export const MESSAGE_ROLES = Object.freeze({ USER: 'user', ASSISTANT: 'assistant' });

/**
 * `web.md` §4: a tela nao guarda estado nem chama API. Tudo o que decide vive
 * aqui, e `Chat.jsx` so' recebe e desenha.
 */
export function useChat() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const conversationId = toConversationId(user.id);
  const [question, setQuestion] = useState('');
  /** Foto escolhida e ainda nao enviada: `{ mediaType, data, previewUrl }`. */
  const [image, setImage] = useState(null);
  const [attachmentFailure, setAttachmentFailure] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);
  const recordingRef = useRef(null);
  const recordingTimerRef = useRef(null);
  /** Foto ou microfone tocados sem estar no plano: o convite aparece no lugar. */
  const [mediaBlocked, setMediaBlocked] = useState(false);
  const plan = usePlanStatus();
  const remaining = chatRemaining(plan);

  const historyQuery = useQuery({
    queryKey: [CHAT_HISTORY_QUERY_KEY, conversationId],
    queryFn: async () =>
      toScreenMessages(await api.entities.ChatMessage.listByConversation(conversationId)),
  });

  const history = historyQuery.data ?? [];

  const sendMutation = useMutation({
    /**
     * A pergunta e' gravada ANTES da chamada paga. Sem chave de IA a resposta e'
     * 503, e gravar so' no fim faria a pergunta do pai sumir junto com a falha:
     * ele veria a propria frase desaparecer da tela sem explicacao.
     *
     * Quem sao os filhos e qual a orientacao do pai nao viajam daqui: a API ja
     * conhece o pai autenticado e monta o contexto do lado dela (`security.md`
     * §1). A tela manda a pergunta, so.
     *
     * `POST /v1/chat` responde e NAO grava: as duas pontas da conversa sao
     * escritas aqui, na ordem em que foram ditas. E' dessa gravacao que a API
     * tira a memoria do mentor: ela le as ultimas falas antes de responder.
     *
     * A foto vai so' para a IA. O que fica gravado e' a marca `📷` com o texto:
     * guardar foto de crianca exigiria cifra, trilha e remocao em cascata, e o
     * mentor ja respondeu sobre ela — a resposta e' o que fica.
     *
     * @param {{ text: string, image: { mediaType: string, data: string, previewUrl: string } | null }} variables
     */
    mutationFn: async ({ text, image: attached }) => {
      await api.entities.ChatMessage.create({
        conversationId,
        role: MESSAGE_ROLES.USER,
        content: attached ? toStoredContent(text, t('chat.photoOnly')) : text,
      });

      const images = attached ? [{ mediaType: attached.mediaType, data: attached.data }] : [];
      const reply = await api.ai.chat(text, { images });

      await api.entities.ChatMessage.create({
        conversationId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: reply,
      });
    },
    /**
     * `onSettled` e nao `onSuccess`: mesmo quando a IA recusa, a pergunta ja
     * esta gravada, e e' o historico do servidor que a traz de volta a tela.
     */
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_HISTORY_QUERY_KEY, conversationId] });
      queryClient.invalidateQueries({ queryKey: PLAN_STATUS_QUERY_KEY });
      inputRef.current?.focus();
    },
  });

  /**
   * Enquanto a chamada corre, a pergunta ainda nao voltou do servidor. Ela sai
   * da propria mutation, e nao de uma lista paralela em `useState` (`web.md` §5):
   * duas listas da mesma conversa divergem na primeira recarga.
   */
  const pendingMessages = sendMutation.isPending
    ? [
        {
          role: MESSAGE_ROLES.USER,
          content: sendMutation.variables.text,
          imageUrl: sendMutation.variables.image?.previewUrl,
        },
      ]
    : [];

  const messages = [...history, ...pendingMessages];

  /**
   * A recusa e' AVISO, nao fala do mentor. Enquanto ela virava uma mensagem de
   * assistente com texto fixo, o motivo escrito pela API se perdia — e o app
   * punha palavra na boca de quem nunca respondeu.
   */
  const sendBlock = sendMutation.isError ? planBlockOf(sendMutation.error) : null;
  const sendFailure = sendMutation.isError && !sendBlock ? describeApiFailure(sendMutation.error) : null;

  /**
   * O convite para assinar. A semana acabou antes de enviar: o app ja sabe e
   * nem grava a pergunta. A API recusou mesmo assim (outra aba gastou a
   * ultima): vale a recusa dela.
   */
  const chatExhausted = remaining === 0;
  const planBlock =
    sendBlock ??
    (chatExhausted ? { lock: PLAN_LOCKS.CHAT_LIMIT, level: plan.level, resetsAt: plan.chat.resets_at } : null) ??
    (mediaBlocked ? { lock: PLAN_LOCKS.CHAT_MEDIA, level: plan.level, resetsAt: null } : null);

  /** O ditado nao envia sozinho: o texto volta para a caixa e o pai confere. */
  const transcribeMutation = useMutation({
    mutationFn: (audio) => api.ai.transcribe(audio),
    onSuccess: (text) => {
      setQuestion((current) => appendTranscript(current, text));
      inputRef.current?.focus();
    },
    onError: (error) => {
      if (planBlockOf(error)) setMediaBlocked(true);
      else setAttachmentFailure(describeApiFailure(error).message);
    },
  });

  /**
   * `messages` e' derivado, entao e' um array novo a cada render: depender dele
   * mandaria a tela rolar sem parar. Quem manda rolar e' a conversa ter crescido.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  /** Se o pai sair da tela gravando, o microfone desliga junto. */
  useEffect(
    () => () => {
      clearTimeout(recordingTimerRef.current);
      recordingRef.current?.cancel();
    },
    [],
  );

  /** @param {string} text */
  function sendQuestion(text) {
    if ((!text.trim() && !image) || sendMutation.isPending || chatExhausted) return;

    setQuestion('');
    setImage(null);
    setAttachmentFailure(null);
    sendMutation.mutate({ text, image });
  }

  function openPhotoPicker() {
    if (!plan.media) {
      setMediaBlocked(true);
      return;
    }
    photoInputRef.current?.click();
  }

  async function handlePhotoChange(event) {
    const [file] = event.target.files ?? [];
    // Limpar o campo deixa escolher a MESMA foto de novo depois de remove-la.
    event.target.value = '';
    if (!file) return;
    setAttachmentFailure(null);
    try {
      setImage(await prepareChatImage(file));
    } catch {
      setAttachmentFailure(t('chat.photoUnreadable'));
    }
  }

  function removePhoto() {
    setImage(null);
  }

  async function stopRecording() {
    clearTimeout(recordingTimerRef.current);
    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!recording) return;
    const audio = await recording.stop();
    if (audio.size > 0) transcribeMutation.mutate(audio);
  }

  async function toggleRecording() {
    if (isRecording) {
      await stopRecording();
      return;
    }
    if (!plan.media) {
      setMediaBlocked(true);
      return;
    }
    setAttachmentFailure(null);
    try {
      recordingRef.current = await startVoiceRecording();
      setIsRecording(true);
      recordingTimerRef.current = setTimeout(stopRecording, VOICE_MAX_SECONDS * 1000);
    } catch {
      setAttachmentFailure(t('chat.micDenied'));
    }
  }

  function handleQuestionChange(event) {
    setQuestion(event.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendQuestion(question);
  }

  return {
    question,
    messages,
    sendFailure,
    attachmentFailure,
    isSending: sendMutation.isPending,
    canSend: (question.trim().length > 0 || image !== null) && !sendMutation.isPending && !chatExhausted,
    planBlock,
    chatRemaining: remaining,
    messagesEndRef,
    inputRef,
    handleQuestionChange,
    handleSubmit,
    sendQuestion,
    photo: {
      previewUrl: image?.previewUrl ?? null,
      inputRef: photoInputRef,
      open: openPhotoPicker,
      handleChange: handlePhotoChange,
      remove: removePhoto,
    },
    voice: {
      isSupported: isVoiceRecordingSupported(),
      isRecording,
      isTranscribing: transcribeMutation.isPending,
      toggle: toggleRecording,
    },
  };
}
