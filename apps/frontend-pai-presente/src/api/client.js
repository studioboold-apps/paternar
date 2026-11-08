/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { ai } from './ai';
import { HTTP_METHODS, buildUrl, request, requestPage, requestUpload } from './http';

const PATHS = Object.freeze({
  me: '/v1/me',
  familyValues: '/v1/me/family-values',
  familyValueOptions: '/v1/family-values/options',
  sessions: '/v1/auth/sessions',
  registrations: '/v1/auth/registrations',
  children: '/v1/children',
  activities: '/v1/activities',
  insightRatings: '/v1/insight-ratings',
  posts: '/v1/community/posts',
  comments: '/v1/community/comments',
  chatMessages: '/v1/chat/messages',
});

/** O teto de `perPage` da API; pedir mais devolve 100 do mesmo jeito. */
const PAGE_SIZE_MAX = 100;

/**
 * A atividade diverge do contrato por mais que maiuscula: `date` e `activityDate`
 * nao se ligam por regra nenhuma, entao a ligacao e escrita.
 */
const ACTIVITY_ALIASES = Object.freeze({
  date: 'activityDate',
  time: 'activityTime',
  completed: 'isCompleted',
});

/**
 * `updateUserBodySchema` e `.strict()` sobre estes quatro campos. Orientacao
 * sexual, religiosa e politica sao dado sensivel (LGPD art. 11) e a permanencia
 * delas e a decisao TL.1 — enquanto ela nao vem, mandar uma so reprovaria a
 * requisicao INTEIRA com 400, e o pai perderia tambem o nome e a idade.
 */
const PROFILE_FIELDS = Object.freeze(['full_name', 'age', 'marital_status', 'onboarding_completed', 'avatar_url', 'city']);

function pickProfileFields(values) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => PROFILE_FIELDS.includes(key)));
}

function buildPageQuery(query, page) {
  return { ...query, page, perPage: PAGE_SIZE_MAX };
}

/**
 * A tela calcula em cima da lista inteira (o boletim soma o mes, o perfil conta
 * as atividades). Devolver so a primeira pagina daria uma conta errada em
 * silencio, que e o pior jeito de errar um numero.
 */
async function listAll(path, options = {}) {
  const first = await requestPage(path, { ...options, query: buildPageQuery(options.query, 1) });
  const totalPages = Math.ceil(first.pagination.total / PAGE_SIZE_MAX);
  if (totalPages <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_unused, index) =>
      requestPage(path, { ...options, query: buildPageQuery(options.query, index + 2) }),
    ),
  );
  return [...first.items, ...rest.flatMap((chunk) => chunk.items)];
}

const Child = Object.freeze({
  list: () => listAll(PATHS.children),
  create: (values) => request(HTTP_METHODS.POST, PATHS.children, { body: values }),
  update: (childId, values) =>
    request(HTTP_METHODS.PATCH, `${PATHS.children}/${childId}`, { body: values }),
  delete: (childId) => request(HTTP_METHODS.DELETE, `${PATHS.children}/${childId}`),
});

/**
 * Os nomes das partes do multipart, iguais aos do `CHILD_FILE_FORM_FIELDS` da
 * API. Sao a mesma palavra em dois repositorios porque nao existe pacote
 * partilhado entre API e frontend hoje; escrever cada uma em quatro lugares
 * dentro desta app e' o que este objeto evita (`code-standart.md` §16).
 */
const CHILD_FILE_FORM_FIELDS = Object.freeze({
  FILE: 'file',
  KIND: 'kind',
  CAPTION: 'caption',
  TAKEN_ON: 'takenOn',
});

function buildChildFilesPath(childId) {
  return `${PATHS.children}/${childId}/files`;
}

/**
 * Campo em branco nao viaja: a API trata texto vazio como ausencia, e mandar
 * `takenOn: ''` faria a data do arquivo depender de um campo que o pai nunca
 * tocou.
 */
function buildChildFileForm({ file, kind, caption, takenOn }) {
  const form = new FormData();
  form.append(CHILD_FILE_FORM_FIELDS.FILE, file);
  form.append(CHILD_FILE_FORM_FIELDS.KIND, kind);
  if (caption !== undefined && caption !== '') form.append(CHILD_FILE_FORM_FIELDS.CAPTION, caption);
  if (takenOn !== undefined && takenOn !== '') form.append(CHILD_FILE_FORM_FIELDS.TAKEN_ON, takenOn);
  return form;
}

const ChildFile = Object.freeze({
  list: (childId) => listAll(buildChildFilesPath(childId)),
  /**
   * O quanto ja' foi usado, e os tetos. Vem numa chamada so' porque a tela
   * mostra os dois numeros juntos — filho e conta —, e duas rotas seriam duas
   * idas ao servidor para desenhar uma linha.
   */
  usage: (childId) => request(HTTP_METHODS.GET, `${buildChildFilesPath(childId)}/usage`),
  upload: ({ childId, file, kind, caption, takenOn }) =>
    requestUpload(buildChildFilesPath(childId), {
      form: buildChildFileForm({ file, kind, caption, takenOn }),
    }),
  delete: ({ childId, fileId }) =>
    request(HTTP_METHODS.DELETE, `${buildChildFilesPath(childId)}/${fileId}`),
});

/**
 * O consentimento do art. 14 §1 e' uma ESCRITA, e a tela precisa dele nos dois
 * sentidos: ler quem ja consentiu (para nao cobrar duas vezes) e conceder. O
 * `POST` e' idempotente pelo `unique(child_id, purpose)` da API, entao aceitar
 * de novo nao cria linha nova nem e' erro.
 */
function buildChildConsentsPath(childId) {
  return `${PATHS.children}/${childId}/consents`;
}

const ChildConsent = Object.freeze({
  list: (childId) => listAll(buildChildConsentsPath(childId)),
  grant: ({ childId, purpose }) =>
    request(HTTP_METHODS.POST, buildChildConsentsPath(childId), { body: { purpose } }),
});

const Activity = Object.freeze({
  list: () => listAll(PATHS.activities, { aliases: ACTIVITY_ALIASES }),
  create: (values) =>
    request(HTTP_METHODS.POST, PATHS.activities, { body: values, aliases: ACTIVITY_ALIASES }),
  update: (activityId, values) =>
    request(HTTP_METHODS.PATCH, `${PATHS.activities}/${activityId}`, {
      body: values,
      aliases: ACTIVITY_ALIASES,
    }),
  delete: (activityId) => request(HTTP_METHODS.DELETE, `${PATHS.activities}/${activityId}`),
});

const InsightRating = Object.freeze({
  list: () => listAll(PATHS.insightRatings),
  /**
   * O insight e gerado na hora e nao tem linha propria: o id dele e a CHAVE da
   * nota, entao vai no caminho, e reavaliar atualiza a mesma linha.
   */
  rate: ({ insight_id: insightId, ...values }) =>
    request(HTTP_METHODS.PUT, `${PATHS.insightRatings}/${insightId}`, { body: values }),
});

const CommunityPost = Object.freeze({
  /** O feed nao pagina na tela; pede um lote e para. */
  list: async (limit) => {
    const { items } = await requestPage(PATHS.posts, { query: { perPage: limit } });
    return items;
  },
  create: (values) => request(HTTP_METHODS.POST, PATHS.posts, { body: values }),
  /** Curtir e um recurso proprio: o cliente nao recalcula mais `liked_by`. */
  like: (postId) => request(HTTP_METHODS.PUT, `${PATHS.posts}/${postId}/like`),
  unlike: (postId) => request(HTTP_METHODS.DELETE, `${PATHS.posts}/${postId}/like`),
  delete: (postId) => request(HTTP_METHODS.DELETE, `${PATHS.posts}/${postId}`),
  /** A foto nao vem na lista: o `<img>` busca pela rota propria, com o cookie da sessao. */
  imageUrl: (postId) => buildUrl(`${PATHS.posts}/${postId}/image`),
});

/**
 * Religiao, politica e orientacao: dado sensivel (LGPD art. 11). So' grava com
 * `consent: true`, e apagar retira o aceite.
 */
const FamilyValues = Object.freeze({
  get: () => request(HTTP_METHODS.GET, PATHS.familyValues),
  save: (values) => request(HTTP_METHODS.PUT, PATHS.familyValues, { body: { ...values, consent: true } }),
  remove: () => request(HTTP_METHODS.DELETE, PATHS.familyValues),
  options: (kind) => request(HTTP_METHODS.GET, PATHS.familyValueOptions, { query: { kind } }),
});

/**
 * Denuncia vai para a fila da equipe. Denunciar de novo o mesmo conteudo nao
 * duplica: a API devolve a denuncia que ja estava aberta.
 */
const CommunityReport = Object.freeze({
  report: ({ type, id }, values) =>
    request(HTTP_METHODS.POST, `${type === 'comment' ? PATHS.comments : PATHS.posts}/${id}/reports`, { body: values }),
});

const CommunityComment = Object.freeze({
  listByPost: (postId) => listAll(PATHS.comments, { query: { postId } }),
  create: (values) => request(HTTP_METHODS.POST, PATHS.comments, { body: values }),
  delete: (commentId) => request(HTTP_METHODS.DELETE, `${PATHS.comments}/${commentId}`),
});

/**
 * `POST /v1/chat` gera a resposta e NAO grava (`ai.use-case.ts`): guardar a
 * conversa e' escrita explicita, dos dois lados, por aqui.
 */
const ChatMessage = Object.freeze({
  listByConversation: (conversationId) => listAll(PATHS.chatMessages, { query: { conversationId } }),
  create: (values) => request(HTTP_METHODS.POST, PATHS.chatMessages, { body: values }),
});

const auth = Object.freeze({
  me: () => request(HTTP_METHODS.GET, PATHS.me),
  updateMe: (values) =>
    request(HTTP_METHODS.PATCH, PATHS.me, { body: pickProfileFields(values) }),
  /**
   * O corpo e' uniao discriminada por `provider`, e viaja INTEIRO: desmontar
   * aqui para remontar campo a campo faria a entrada por senha perder `email` e
   * `password` em silencio, que e' o mesmo erro que o schema estrito da API
   * pega tarde demais.
   *
   * Credencial no CORPO, nunca em query string: la ela vazaria para log,
   * historico do navegador e Referer.
   */
  signIn: (credentials) => request(HTTP_METHODS.POST, PATHS.sessions, { body: credentials }),
  /** Nome em branco nao e' um valor, e' ausencia de pedido — e ausencia se omite. */
  register: ({ email, password, fullName = '' }) =>
    request(HTTP_METHODS.POST, PATHS.registrations, {
      body: fullName === '' ? { email, password } : { email, password, fullName },
    }),
  logout: () => request(HTTP_METHODS.DELETE, PATHS.sessions),
});

export const api = Object.freeze({
  auth,
  ai,
  entities: Object.freeze({
    Child,
    ChildFile,
    ChildConsent,
    Activity,
    InsightRating,
    CommunityPost,
    FamilyValues,
    CommunityComment,
    CommunityReport,
    ChatMessage,
  }),
});
