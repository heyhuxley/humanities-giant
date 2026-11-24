import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnswerDeps, toCorrectIndex } from './answer-deps';

const database = vi.hoisted(() => ({
  sessionQuestion: { data: { question_id: 'question-row-id' }, error: null } as {
    data: unknown;
    error: Error | null;
  },
  answer: { data: { correct_index: 2 }, error: null } as {
    data: unknown;
    error: Error | null;
  },
  operations: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('../supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        select(columns: string) {
          database.operations.push(`select:${table}:${columns}`);
          return this;
        },
        eq(column: string, value: string | number) {
          database.operations.push(`eq:${table}:${column}:${value}`);
          return this;
        },
        async maybeSingle() {
          database.operations.push(`maybeSingle:${table}`);
          return table === 'session_questions'
            ? database.sessionQuestion
            : database.answer;
        },
      };
    },
  }),
}));

beforeEach(() => {
  database.sessionQuestion = { data: { question_id: 'question-row-id' }, error: null };
  database.answer = { data: { correct_index: 2 }, error: null };
  database.operations.length = 0;
});

describe('toCorrectIndex', () => {
  it.each([0, 1, 2, 3])('accepts option %s', (value) => {
    expect(toCorrectIndex({ correct_index: value })).toBe(value);
  });

  it.each([
    ['missing row', null],
    ['missing field', {}],
    ['string', { correct_index: '2' }],
    ['float', { correct_index: 1.5 }],
    ['negative', { correct_index: -1 }],
    ['four', { correct_index: 4 }],
    ['null', { correct_index: null }],
  ])('returns null for %s', (_label, row) => {
    expect(toCorrectIndex(row)).toBeNull();
  });
});

describe('createAnswerDeps', () => {
  it('loads the position question first, then selects only its correct index', async () => {
    await expect(createAnswerDeps().loadCorrectIndex('session-row-id', 7)).resolves.toBe(2);
    expect(database.operations).toEqual([
      'select:session_questions:question_id',
      'eq:session_questions:session_id:session-row-id',
      'eq:session_questions:position:7',
      'maybeSingle:session_questions',
      'select:question_answers:correct_index',
      'eq:question_answers:question_id:question-row-id',
      'maybeSingle:question_answers',
    ]);
  });

  it('returns null and skips answer lookup when the session question is missing', async () => {
    database.sessionQuestion = { data: null, error: null };

    await expect(createAnswerDeps().loadCorrectIndex('session-row-id', 7)).resolves.toBeNull();
    expect(database.operations).not.toContain('maybeSingle:question_answers');
  });

  it('returns null when the answer row is missing', async () => {
    database.answer = { data: null, error: null };

    await expect(createAnswerDeps().loadCorrectIndex('session-row-id', 7)).resolves.toBeNull();
  });
});
