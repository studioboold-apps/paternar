/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { beforeEach, describe, expect, test } from 'bun:test';

import {
  createTestClient,
  MISSING_ID,
  readDataRecord,
  readErrorCode,
  TEST_USER,
  TEST_USER_ID,
  type TestClient,
} from '../../testing/http-test.util';
import { applyOverrides, buildIdentity } from '../../testing/row.factory';
import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_METHODS } from '../shared/http/http.constant';
import { UNKNOWN_CLIENT_IP } from '../shared/shared.constant';
import { buildUserRoutes } from './user.controller';
import { ME_EXPORT_PATH, ME_PATH } from './user.constant';
import { createUserUseCases } from './user.use-case';
import type { UserRow } from './user.table';
import { CHILD_FILE_KINDS } from '../shared/shared.constant';
import type {
  ChildFileExport,
  ChildFileExportPort,
} from '../shared/child-file-export.interface';
import type { ChildFilePurgePort } from '../shared/child-file-purge.interface';
import type {
  AccountExportWithoutFiles,
  DeleteUserParams,
  UserRepository,
} from './types/user.types';

type RecordedRemoval = { readonly userId: string; readonly clientIp: string };

function buildUserRow(): UserRow {
  return {
    ...buildIdentity(TEST_USER_ID),
    email: TEST_USER.email,
    fullName: 'Joao',
    avatarUrl: null,
    city: null,
    age: 34,
    maritalStatus: null,
    onboardingCompleted: false,
    blockedAt: null,
  };
}

const EXPORTED_CHILD_ID = '00000000-0000-4000-8000-0000000000c1';
const EXPORTED_FILE_ID = '00000000-0000-4000-8000-0000000000f1';

/**
 * O que a porta do `ChildFile` devolve. Aqui e' dado de teste: o que se afirma
 * neste arquivo e' que a secao CHEGA ao titular, nao como ela e' montada — quem
 * esconde a `objectKey` e monta o caminho do conteudo tem teste no proprio
 * modulo.
 */
const EXPORTED_FILE: ChildFileExport = {
  id: EXPORTED_FILE_ID,
  childId: EXPORTED_CHILD_ID,
  kind: CHILD_FILE_KINDS[0],
  contentType: 'image/jpeg',
  byteSize: 12,
  checksum: 'a'.repeat(64),
  caption: undefined,
  takenOn: undefined,
  createdAt: new Date('2026-09-07T00:00:00.000Z'),
  contentPath: `/v1/children/${EXPORTED_CHILD_ID}/files/${EXPORTED_FILE_ID}/content`,
};

function buildAccountExportWithoutFiles(row: UserRow): AccountExportWithoutFiles {
  return {
    user: row,
    authIdentities: [],
    children: [],
    activities: [],
    insightRatings: [],
    communityPosts: [],
    communityPostLikes: [],
    communityComments: [],
    chatMessages: [],
    familyValues: [],
  };
}

function createFakeUserRepository(rows: UserRow[], removals: RecordedRemoval[]): UserRepository {
  const indexOf = (userId: string): number => rows.findIndex((row) => row.id === userId);
  return {
    findById: async ({ userId }) => rows[indexOf(userId)],
    update: async ({ userId, values }) => {
      const index = indexOf(userId);
      const current = rows[index];
      if (current === undefined) return undefined;
      const updated: UserRow = applyOverrides(current, values);
      rows[index] = updated;
      return updated;
    },
    deleteById: async ({ userId, clientIp }: DeleteUserParams) => {
      const index = indexOf(userId);
      if (index < 0) return false;
      rows.splice(index, 1);
      removals.push({ userId, clientIp });
      return true;
    },
    exportAll: async ({ userId }) => {
      const row = rows[indexOf(userId)];
      return row === undefined ? undefined : buildAccountExportWithoutFiles(row);
    },
  };
}

type PurgeCall = {
  readonly userId: string;
  readonly clientIp: string;
  /**
   * Se a conta ainda estava no banco na hora da varredura, os BYTES sairam
   * antes dela. E' a unica forma de afirmar a ORDEM sem espiar o codigo: uma
   * dupla que so' contasse chamadas ficaria verde com a ordem invertida — e a
   * ordem invertida e' justamente a que deixa objeto inominavel no balde.
   */
  readonly accountWasStillThere: boolean;
};

type BuildClientParams = {
  readonly rows: UserRow[];
  readonly removals: RecordedRemoval[];
  readonly purgeCalls: PurgeCall[];
  readonly exportCalls: string[];
};

function buildClient({ rows, removals, purgeCalls, exportCalls }: BuildClientParams): TestClient {
  /**
   * Porta separada da varredura, e nao um metodo a mais nela: `Child` tambem
   * usa a varredura e nao exporta nada. Numa porta so', ele teria de fingir um
   * `listForExport` que nunca chama.
   */
  const childFileExport: ChildFileExportPort = {
    listForExport: async ({ userId }) => {
      exportCalls.push(userId);
      return [EXPORTED_FILE];
    },
  };
  const childFiles: ChildFilePurgePort = {
    purgeByChild: async () => {
      throw new Error('apagar a conta nao varre filho por filho');
    },
    purgeByUser: async ({ userId, clientIp }) => {
      purgeCalls.push({ userId, clientIp, accountWasStillThere: rows.some((row) => row.id === userId) });
    },
  };
  return createTestClient({
    routes: buildUserRoutes(
      createUserUseCases({
        repository: createFakeUserRepository(rows, removals),
        childFiles,
        childFileExport,
      }),
    ),
  });
}

let client: TestClient;
let removals: RecordedRemoval[];
let purgeCalls: PurgeCall[];
let exportCalls: string[];

beforeEach(() => {
  removals = [];
  purgeCalls = [];
  exportCalls = [];
  client = buildClient({ rows: [buildUserRow()], removals, purgeCalls, exportCalls });
});

describe('GET /v1/me', () => {
  test('devolve o usuario da sessao', async () => {
    const response = await client.send({ method: HTTP_METHODS.GET, path: ME_PATH });
    expect(response.status).toBe(200);
    expect(readDataRecord(response).email).toBe(TEST_USER.email);
  });

  test('sessao apontando para usuario inexistente responde 404', async () => {
    const orphan = buildClient({
      rows: [{ ...buildUserRow(), ...buildIdentity(MISSING_ID) }],
      removals,
      purgeCalls,
      exportCalls,
    });
    const response = await orphan.send({ method: HTTP_METHODS.GET, path: ME_PATH });
    expect(response.status).toBe(404);
    expect(readErrorCode(response)).toBe(ERROR_CODES.user.USER_NOT_FOUND);
  });
});

describe('PATCH /v1/me', () => {
  test('conclui o onboarding', async () => {
    const response = await client.send({
      method: HTTP_METHODS.PATCH,
      path: ME_PATH,
      body: { onboardingCompleted: true },
    });
    expect(response.status).toBe(200);
    expect(readDataRecord(response).onboardingCompleted).toBe(true);
  });

  test('email no corpo responde 400: identidade vem da sessao, nao do cliente', async () => {
    const response = await client.send({
      method: HTTP_METHODS.PATCH,
      path: ME_PATH,
      body: { email: 'outro@exemplo.com' },
    });
    expect(response.status).toBe(400);
    expect(readErrorCode(response)).toBe(ERROR_CODES.shared.VALIDATION_FAILED);
  });

  /**
   * `TL.1`: orientacao sexual, religiosa e politica sao dado sensivel (LGPD
   * art. 11) e nao existem na base nova. O prompt de IA, unico consumidor que
   * elas tinham na Base44, deixou de as pedir.
   *
   * A tela ja parou de perguntar, mas tela se reescreve; a fronteira e' que
   * decide. Sem este teste, uma coluna de volta passaria despercebida — foi
   * exatamente assim que o Perfil ficou um mes oferecendo tres campos que o
   * cliente descartava antes de enviar.
   */
  test('campo de orientacao no corpo responde 400: dado sensivel nao entra', async () => {
    for (const field of ['sexualOrientation', 'religiousOrientation', 'politicalOrientation']) {
      const response = await client.send({
        method: HTTP_METHODS.PATCH,
        path: ME_PATH,
        body: { [field]: 'qualquer' },
      });
      expect(response.status).toBe(400);
      expect(readErrorCode(response)).toBe(ERROR_CODES.shared.VALIDATION_FAILED);
    }
  });
});

/**
 * Art. 18 da LGPD da ao titular ELIMINACAO (inciso VI) e PORTABILIDADE (V), e
 * este produto guarda dado de crianca. Ate aqui `/v1/me` so tinha `GET` e
 * `PATCH`: o pai que quisesse sair teria de pedir por e-mail a alguem que
 * apagasse na mao — o que nao e' direito exercivel, e' favor.
 */
describe('DELETE /v1/me', () => {
  test('apagar responde 204 e a conta deixa de existir', async () => {
    const removed = await client.send({ method: HTTP_METHODS.DELETE, path: ME_PATH });
    expect(removed.status).toBe(204);

    const after = await client.send({ method: HTTP_METHODS.GET, path: ME_PATH });
    expect(after.status).toBe(404);
  });

  test('apagar duas vezes responde 404 na segunda, nao 204 mentindo', async () => {
    await client.send({ method: HTTP_METHODS.DELETE, path: ME_PATH });
    const again = await client.send({ method: HTTP_METHODS.DELETE, path: ME_PATH });

    expect(again.status).toBe(404);
    expect(readErrorCode(again)).toBe(ERROR_CODES.user.USER_NOT_FOUND);
  });

  /**
   * `security.md` §10: a trilha guarda ator, alvo, IP e instante. O IP tem de
   * ATRAVESSAR a rota ate a escrita — foi por nao atravessar que a auditoria
   * de outros produtos nasceu com a coluna sempre vazia.
   */
  test('o endereco de quem pediu chega ate a escrita', async () => {
    await client.send({
      method: HTTP_METHODS.DELETE,
      path: ME_PATH,
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });

    expect(removals).toEqual([{ userId: TEST_USER_ID, clientIp: '203.0.113.7' }]);
  });

  test('sem cabecalho de proxy, a trilha registra que nao sabe o endereco', async () => {
    await client.send({ method: HTTP_METHODS.DELETE, path: ME_PATH });

    expect(removals[0]?.clientIp).toBe(UNKNOWN_CLIENT_IP);
  });

  /**
   * `ON DELETE CASCADE` leva as LINHAS dos arquivos e nenhum byte: o Postgres
   * nao sabe que o balde existe. E como `MediaStorage` nao tem `list()` de
   * proposito, byte cuja linha a cascata levou e' byte que ninguem consegue
   * mais NOMEAR para apagar. Por isso a varredura vem antes do `DELETE`.
   */
  test('os bytes do balde saem ANTES da conta', async () => {
    const response = await client.send({
      method: HTTP_METHODS.DELETE,
      path: ME_PATH,
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });

    expect(response.status).toBe(204);
    expect(purgeCalls).toEqual([
      { userId: TEST_USER_ID, clientIp: '203.0.113.7', accountWasStillThere: true },
    ]);
  });

  /**
   * Conta que nao existe varre o proprio nada e ainda assim responde 404: a
   * varredura e' escopada pelo `userId` da sessao, entao ela nao alcanca dado
   * de ninguem. Checar a existencia primeiro seria segunda copia da regra que o
   * repositorio ja tem.
   */
  test('conta inexistente responde 404 depois de varrer o proprio nada', async () => {
    const orphan = buildClient({ rows: [], removals, purgeCalls, exportCalls });

    const response = await orphan.send({ method: HTTP_METHODS.DELETE, path: ME_PATH });

    expect(response.status).toBe(404);
    expect(purgeCalls[0]?.userId).toBe(TEST_USER_ID);
  });
});

describe('GET /v1/me/export', () => {
  /**
   * Portabilidade so vale se vier TUDO: uma secao ausente e' indistinguivel de
   * uma secao vazia para quem recebe o arquivo, e o titular nao tem como saber
   * que faltou. Por isso a chave existe mesmo sem linha nenhuma.
   */
  test('devolve o perfil e todas as secoes, mesmo as vazias', async () => {
    const response = await client.send({ method: HTTP_METHODS.GET, path: ME_EXPORT_PATH });

    expect(response.status).toBe(200);
    const payload = readDataRecord(response);
    expect(payload.user).toMatchObject({ email: TEST_USER.email });
    for (const section of [
      'authIdentities',
      'children',
      'activities',
      'insightRatings',
      'communityPosts',
      'communityPostLikes',
      'communityComments',
      'chatMessages',
      'childFiles',
    ]) {
      expect(Array.isArray(payload[section])).toBe(true);
    }
  });

  /**
   * A secao dos arquivos vem por PORTA, do `ChildFile`: a vista que esconde a
   * `objectKey` e o caminho por onde os bytes saem moram la'. Uma consulta
   * propria aqui seria uma segunda copia dessa vista (`code-standart.md` §16),
   * e a edicao que faltasse nela mandaria a chave do balde dentro de um arquivo
   * que o pai baixa.
   */
  test('os arquivos do filho entram na exportacao', async () => {
    const response = await client.send({ method: HTTP_METHODS.GET, path: ME_EXPORT_PATH });

    expect(response.status).toBe(200);
    expect(exportCalls).toEqual([TEST_USER_ID]);
    const files = readDataRecord(response).childFiles as readonly Record<string, unknown>[];
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ id: EXPORTED_FILE_ID, childId: EXPORTED_CHILD_ID });
  });

  /**
   * JSON nao carrega byte. Uma secao que lista quarenta fotos sem dizer o
   * endereco de nenhuma e' catalogo, nao portabilidade: o titular fica sabendo
   * que os arquivos existem e sem como pega-los. No aplicativo o caminho e'
   * montado pela tela; num arquivo baixado nao ha tela nenhuma.
   */
  test('cada arquivo diz onde buscar os bytes', async () => {
    const response = await client.send({ method: HTTP_METHODS.GET, path: ME_EXPORT_PATH });

    const files = readDataRecord(response).childFiles as readonly Record<string, unknown>[];
    expect(files[0]?.contentPath).toBe(EXPORTED_FILE.contentPath);
  });

  /** A chave do balde e' desenho interno: quem a conhece adivinha a do vizinho. */
  test('a exportacao nao carrega a chave do balde', async () => {
    const response = await client.send({ method: HTTP_METHODS.GET, path: ME_EXPORT_PATH });

    expect(JSON.stringify(response.payload)).not.toContain('objectKey');
  });

  test('conta ja apagada nao exporta nada', async () => {
    await client.send({ method: HTTP_METHODS.DELETE, path: ME_PATH });
    const response = await client.send({ method: HTTP_METHODS.GET, path: ME_EXPORT_PATH });

    expect(response.status).toBe(404);
  });
});
