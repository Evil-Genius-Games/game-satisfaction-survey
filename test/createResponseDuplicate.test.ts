import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  duplicateResponseId: null as number | null,
  queries: [] as Array<{ sql: string; params: unknown[] }>,
}));

const mockClient = vi.hoisted(() => ({
  async query(sql: string, params: unknown[] = []) {
    mockState.queries.push({ sql, params });

    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }

    if (sql.includes('SELECT id, is_active FROM surveys')) {
      return { rows: [{ id: params[0], is_active: true }] };
    }

    if (sql.includes('SELECT id, display_order')) {
      return {
        rows: [
          { id: 101, display_order: 1 },
          { id: 102, display_order: 2 },
          { id: 103, display_order: 3 },
        ],
      };
    }

    if (sql.includes('SELECT id, question_type, is_required, validation_rules FROM questions')) {
      return {
        rows: [
          { id: 101, question_type: 'short_text', is_required: true, validation_rules: null },
          { id: 102, question_type: 'short_text', is_required: true, validation_rules: null },
          { id: 103, question_type: 'short_text', is_required: true, validation_rules: null },
          { id: 104, question_type: 'rating', is_required: true, validation_rules: { min: 1, max: 10 } },
        ],
      };
    }

    if (sql.includes('SELECT r.id')) {
      return { rows: mockState.duplicateResponseId ? [{ id: mockState.duplicateResponseId }] : [] };
    }

    if (sql.includes('INSERT INTO responses')) {
      return { rows: [{ id: 789 }] };
    }

    if (sql.includes('INSERT INTO answers')) {
      return { rows: [] };
    }

    return { rows: [] };
  },
  release: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function Pool() {
    return {
      connect: vi.fn(async () => mockClient),
    };
  }),
}));

import { createResponse } from '../lib/db';

const comboAnswers = [
  { question_id: 101, answer_text: 'Big Show' },
  { question_id: 102, answer_text: 'Ada GM' },
  { question_id: 103, answer_text: 'Dragon Heist' },
  { question_id: 104, answer_value: '10' },
];

describe('createResponse duplicate-combination prevention', () => {
  beforeEach(() => {
    mockState.duplicateResponseId = null;
    mockState.queries = [];
    mockClient.release.mockClear();
  });

  it('stores participant metadata and accepts the first convention, GM, and adventure response', async () => {
    const responseId = await createResponse(1, comboAnswers, {
      participantId: 'participant-1',
      participantKey: 'browser-key-1',
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest Browser',
    });

    expect(responseId).toBe(789);

    const responseInsert = mockState.queries.find((query) => query.sql.includes('INSERT INTO responses'));
    expect(responseInsert).toBeDefined();
    expect(JSON.parse(responseInsert?.params[5] as string)).toMatchObject({
      participant_id: 'participant-1',
      participant_key: 'browser-key-1',
      survey_combo: {
        convention: 'Big Show',
        gm: 'Ada GM',
        adventure: 'Dragon Heist',
      },
    });
    expect(mockState.queries.some((query) => query.sql === 'COMMIT')).toBe(true);
  });

  it('rejects a duplicate convention, GM, and adventure response for the same participant', async () => {
    mockState.duplicateResponseId = 456;

    await expect(
      createResponse(1, comboAnswers, {
        participantId: 'participant-1',
        participantKey: 'browser-key-1',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Thanks for playing! You’ve already completed the survey for this convention, GM, and adventure. We’d love to hear from you again—please sign up for another game and share feedback after that session.',
      existingResponseId: 456,
    });

    expect(mockState.queries.some((query) => query.sql.includes('INSERT INTO responses'))).toBe(false);
    expect(mockState.queries.some((query) => query.sql === 'ROLLBACK')).toBe(true);
  });
});
