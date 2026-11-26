import { describe, expect, it } from 'vitest';
import { readCurrentQuestion, readPublicState } from './read-public-state';

describe('readPublicState', () => {
  it('reads a valid waiting state', () => {
    expect(readPublicState({
      status: 'waiting',
      winnings: null,
      finishReason: null,
    })).toEqual({
      status: 'waiting',
      winnings: null,
      finishReason: null,
      position: null,
      amountAtStake: null,
      questionEndsAt: null,
      contestantId: null,
      lockedAnswer: null,
      correctIndex: null,
      lastResult: null,
    });
  });

  it('reads a valid question_active state without exposing the answer index', () => {
    const result = readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      position: 3,
      questionEndsAt: 20_000,
      contestantId: 'contestant-id',
      lockedAnswer: null,
      correctIndex: 2,
      lastResult: 'correct',
      selectedAnswer: 1,
      ignored: 'extra',
    });
    const question = readCurrentQuestion({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
    });

    expect(result).toEqual({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      position: 3,
      amountAtStake: 15_000,
      questionEndsAt: 20_000,
      contestantId: 'contestant-id',
      lockedAnswer: null,
      correctIndex: null,
      lastResult: null,
    });
    expect(result).not.toHaveProperty('selectedAnswer');
    expect(question).toEqual({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
    });
    expect(question).not.toHaveProperty('correctIndex');
  });

  it('reads finished winnings and reason', () => {
    expect(readPublicState({
      status: 'finished',
      winnings: 30000,
      finishReason: 'walked_away',
    })).toEqual({
      status: 'finished',
      winnings: 30000,
      finishReason: 'walked_away',
      position: null,
      amountAtStake: null,
      questionEndsAt: null,
      contestantId: null,
      lockedAnswer: null,
      correctIndex: null,
      lastResult: null,
    });
  });

  it('reads a valid locked answer', () => {
    expect(readPublicState({
      status: 'locked',
      winnings: null,
      finishReason: null,
      position: 5,
      questionEndsAt: 30_000,
      contestantId: 'contestant-id',
      lockedAnswer: 2,
    })).toMatchObject({
      position: 5,
      amountAtStake: 30_000,
      lockedAnswer: 2,
      correctIndex: null,
      lastResult: null,
    });
  });

  it.each(['waiting', 'question_active', 'locked'] as const)(
    'does not expose reveal fields in %s even when supplied',
    (status) => {
      expect(readPublicState({
        status,
        winnings: null,
        finishReason: null,
        correctIndex: 2,
        lastResult: 'correct',
      })).toMatchObject({ correctIndex: null, lastResult: null });
    },
  );

  it.each(['revealed', 'finished'] as const)(
    'exposes valid reveal fields in %s',
    (status) => {
      expect(readPublicState({
        status,
        winnings: null,
        finishReason: null,
        correctIndex: 2,
        lastResult: 'correct',
      })).toMatchObject({ correctIndex: 2, lastResult: 'correct' });
    },
  );

  it.each([4, -1, 1.5, '2', null, undefined])(
    'returns a null answer index for malformed reveal value %s',
    (correctIndex) => {
      expect(readPublicState({
        status: 'revealed',
        winnings: null,
        finishReason: null,
        correctIndex,
        lastResult: 'correct',
      })).toMatchObject({ correctIndex: null, lastResult: 'correct' });
    },
  );

  it.each(['maybe', 5, null, undefined])(
    'returns a null result for malformed reveal result %s',
    (lastResult) => {
      expect(readPublicState({
        status: 'revealed',
        winnings: null,
        finishReason: null,
        correctIndex: 2,
        lastResult,
      })).toMatchObject({ correctIndex: 2, lastResult: null });
    },
  );

  it('ignores extra properties in revealed states', () => {
    expect(readPublicState({
      status: 'revealed',
      winnings: null,
      finishReason: null,
      correctIndex: 2,
      lastResult: 'correct',
      extra: 'ignored',
    })).not.toHaveProperty('extra');
  });

  it('returns null for malformed answering fields', () => {
    expect(readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      position: 0,
      questionEndsAt: 30_000,
      contestantId: 'contestant-id',
      lockedAnswer: 4,
    })).toMatchObject({
      position: null,
      amountAtStake: null,
      lockedAnswer: null,
    });

    expect(readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      position: 16,
      questionEndsAt: '30s',
      contestantId: 42,
      lockedAnswer: null,
    })).toMatchObject({
      position: null,
      amountAtStake: null,
      questionEndsAt: null,
      contestantId: null,
    });
  });

  it('defaults missing question ends and contestant fields', () => {
    expect(readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      position: 1,
      contestantId: null,
      lockedAnswer: null,
    })).toMatchObject({
      position: 1,
      amountAtStake: 5_000,
      questionEndsAt: null,
      contestantId: null,
      lockedAnswer: null,
    });
  });

  it.each([16, '5', 0, null, undefined])(
    'returns null position and amount for malformed position %s',
    (position) => {
      expect(readPublicState({
        status: 'question_active',
        winnings: null,
        finishReason: null,
        position,
      })).toMatchObject({
        position: null,
        amountAtStake: null,
      });
    },
  );

  it.each([
    ['missing status', { winnings: null, finishReason: null }],
    ['missing winnings', { status: 'waiting', finishReason: null }],
    ['missing finish reason', { status: 'waiting', winnings: null }],
    ['unknown status', { status: 'paused', winnings: null, finishReason: null }],
    ['string winnings', { status: 'finished', winnings: '30000', finishReason: 'won' }],
    ['fractional winnings', { status: 'finished', winnings: 1.5, finishReason: 'won' }],
    ['unknown finish reason', { status: 'finished', winnings: 0, finishReason: 'other' }],
  ])('returns null for %s', (_label, value) => {
    expect(readPublicState(value)).toBeNull();
  });

  it('returns null for non object values', () => {
    expect(readPublicState(null)).toBeNull();
    expect(readPublicState([])).toBeNull();
  });
});

describe('readCurrentQuestion', () => {
  it('reads an active question and ignores extra properties', () => {
    const result = readCurrentQuestion({
      id: 'question-id',
      text: 'Question text',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      ['correct' + '_index']: 2,
      answer: 'C',
    });

    expect(result).toEqual({
      id: 'question-id',
      text: 'Question text',
      options: ['A', 'B', 'C', 'D'],
    });
    expect(result).not.toHaveProperty('correctIndex');
    expect(result).not.toHaveProperty('correct' + '_index');
    expect(result).not.toHaveProperty('answer');
  });

  it('returns null for a missing question', () => {
    expect(readCurrentQuestion(null)).toBeNull();
  });

  it.each([
    ['missing id', { text: 'Question', options: ['A', 'B', 'C', 'D'] }],
    ['empty text', { id: 'question-id', text: '', options: ['A', 'B', 'C', 'D'] }],
    ['three options', { id: 'question-id', text: 'Question', options: ['A', 'B', 'C'] }],
    ['non string option', { id: 'question-id', text: 'Question', options: ['A', 'B', 3, 'D'] }],
  ])('returns null for a malformed question with %s', (_label, value) => {
    expect(readCurrentQuestion(value)).toBeNull();
  });
});
