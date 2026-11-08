/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { beforeEach, describe, expect, test } from 'bun:test';

import {
  createTestClient,
  KNOWN_ID,
  MISSING_ID,
  OTHER_USER_ID,
  readDataRecord,
  readErrorCode,
  TEST_USER_ID,
  type TestClient,
} from '../../testing/http-test.util';
import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_METHODS } from '../shared/http/http.constant';
import { buildCommunityReportRoutes } from './community-report.controller';
import { createCommunityReportUseCases } from './community-report.use-case';
import type { CommunityReportRepository, ReportTarget } from './types/community-report.types';

const COMMENT_ID = '55555555-5555-4555-8555-555555555555';

type StoredReport = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reportedUserId: string;
  snapshot: string;
  reason: string;
  status: string;
};

function createFakeRepository(stored: StoredReport[]): CommunityReportRepository {
  const targets: Record<string, ReportTarget> = {
    [`post:${KNOWN_ID}`]: { authorId: OTHER_USER_ID, content: 'post ofensivo', postId: KNOWN_ID, commentId: null },
    [`comment:${COMMENT_ID}`]: { authorId: OTHER_USER_ID, content: 'comentario ruim', postId: KNOWN_ID, commentId: COMMENT_ID },
  };
  const view = (row: StoredReport) => ({ id: row.id, status: row.status, createdAt: new Date('2026-11-08T12:00:00Z') });
  return {
    findTarget: async ({ targetType, targetId }) => targets[`${targetType}:${targetId}`],
    findOpen: async ({ reporterId, targetType, targetId }) => {
      const row = stored.find(
        (entry) =>
          entry.reporterId === reporterId &&
          entry.targetType === targetType &&
          entry.targetId === targetId &&
          entry.status === 'open',
      );
      return row ? view(row) : undefined;
    },
    insert: async ({ reporterId, targetType, target, values }) => {
      const row: StoredReport = {
        id: `r${stored.length + 1}`,
        reporterId,
        targetType,
        targetId: target.commentId ?? target.postId,
        reportedUserId: target.authorId,
        snapshot: target.content,
        reason: values.reason,
        status: 'open',
      };
      stored.push(row);
      return view(row);
    },
  };
}

let stored: StoredReport[];
let client: TestClient;

beforeEach(() => {
  stored = [];
  client = createTestClient({ routes: buildCommunityReportRoutes(createCommunityReportUseCases(createFakeRepository(stored))) });
});

describe('POST /v1/community/posts/:postId/reports', () => {
  test('cria a denuncia com o autor do post e a copia do texto', async () => {
    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: `/v1/community/posts/${KNOWN_ID}/reports`,
      body: { reason: 'ofensivo', details: 'xingou outro pai' },
    });
    expect(response.status).toBe(201);
    expect(readDataRecord(response).status).toBe('open');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ reporterId: TEST_USER_ID, reportedUserId: OTHER_USER_ID, snapshot: 'post ofensivo' });
  });

  test('denunciar de novo o mesmo post nao duplica a fila', async () => {
    const send = () =>
      client.send({ method: HTTP_METHODS.POST, path: `/v1/community/posts/${KNOWN_ID}/reports`, body: { reason: 'spam' } });
    await send();
    const again = await send();
    expect(again.status).toBe(200);
    expect(stored).toHaveLength(1);
  });

  test('post que nao existe responde 404', async () => {
    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: `/v1/community/posts/${MISSING_ID}/reports`,
      body: { reason: 'spam' },
    });
    expect(response.status).toBe(404);
    expect(readErrorCode(response)).toBe(ERROR_CODES.community.POST_NOT_FOUND);
  });

  test('motivo fora da lista responde 400', async () => {
    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: `/v1/community/posts/${KNOWN_ID}/reports`,
      body: { reason: 'nao-gostei' },
    });
    expect(response.status).toBe(400);
  });
});

describe('POST /v1/community/comments/:commentId/reports', () => {
  test('denuncia o comentario e guarda o post de origem', async () => {
    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: `/v1/community/comments/${COMMENT_ID}/reports`,
      body: { reason: 'golpe' },
    });
    expect(response.status).toBe(201);
    expect(stored[0]).toMatchObject({ targetType: 'comment', targetId: COMMENT_ID, snapshot: 'comentario ruim' });
  });

  test('comentario que nao existe responde 404', async () => {
    const response = await client.send({
      method: HTTP_METHODS.POST,
      path: `/v1/community/comments/${MISSING_ID}/reports`,
      body: { reason: 'golpe' },
    });
    expect(readErrorCode(response)).toBe(ERROR_CODES.community.COMMENT_NOT_FOUND);
  });
});
