import { describe, expect, it } from 'vitest';
import { readCurrentQuestion, readPublicState } from './read-public-state';

const UNUSED_LIFELINES = {
  fiftyFifty: { used: false, usedAtPosition: null, removed: null },
  phone: { used: false, usedAtPosition: null, hint: null },
  audience: {
    used: false,
    usedAtPosition: null,
    percentages: null,
    notEnoughVotes: false,
  },
};

function readLifelines(
  status: 'waiting' | 'question_active' | 'locked' | 'revealed' | 'finished',
  position: number | null,
  lifelines: unknown,
) {
  return readPublicState({
    status,
    winnings: null,
    finishReason: null,
    position,
    lifelines,
  })?.lifelines;
}

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
      lifelines: UNUSED_LIFELINES,
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
      lifelines: UNUSED_LIFELINES,
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
      lifelines: UNUSED_LIFELINES,
    });
  });

  it.each(['waiting', 'question_active', 'locked', 'revealed', 'finished'] as const)(
    'returns lifeline usage in %s',
    (status) => {
      expect(readPublicState({
        status,
        winnings: null,
        finishReason: null,
      })?.lifelines).toEqual(UNUSED_LIFELINES);
    },
  );

  it('reads all three used lifelines and their positions', () => {
    expect(readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      position: 3,
      lifelines: {
        fiftyFifty: { used: true, usedAtPosition: 2, removed: [0, 1] },
        phone: { used: true, usedAtPosition: 5, hint: 2, hintIsCorrect: true },
        audience: {
          used: true,
          usedAtPosition: 10,
          percentages: [25, 25, 25, 25],
          notEnoughVotes: false,
        },
      },
    })?.lifelines).toEqual({
      fiftyFifty: { used: true, usedAtPosition: 2, removed: null },
      phone: { used: true, usedAtPosition: 5, hint: null },
      audience: {
        used: true,
        usedAtPosition: 10,
        percentages: null,
        notEnoughVotes: false,
      },
    });
  });

  it('reads mixed lifeline usage', () => {
    expect(readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      lifelines: {
        fiftyFifty: { used: true, usedAtPosition: 1 },
        phone: { used: false, usedAtPosition: null },
        audience: { used: true, usedAtPosition: 15 },
      },
    })?.lifelines).toEqual({
      fiftyFifty: { used: true, usedAtPosition: 1, removed: null },
      phone: { used: false, usedAtPosition: null, hint: null },
      audience: {
        used: true,
        usedAtPosition: 15,
        percentages: null,
        notEnoughVotes: false,
      },
    });
  });

  it.each(['true', 1])('rejects non boolean used value %s', (used) => {
    expect(readPublicState({
      status: 'waiting',
      winnings: null,
      finishReason: null,
      lifelines: {
        fiftyFifty: { used, usedAtPosition: 3 },
      },
    })?.lifelines.fiftyFifty).toEqual({
      used: false,
      usedAtPosition: 3,
      removed: null,
    });
  });

  it.each([0, 16, 1.5, '3'])(
    'rejects malformed lifeline position %s',
    (usedAtPosition) => {
      expect(readPublicState({
        status: 'waiting',
        winnings: null,
        finishReason: null,
        lifelines: {
          fiftyFifty: { used: true, usedAtPosition },
        },
      })?.lifelines.fiftyFifty).toEqual({
        used: true,
        usedAtPosition: null,
        removed: null,
      });
    },
  );

  it.each([undefined, null, [], 'invalid'])(
    'defaults missing or non object lifelines %s',
    (lifelines) => {
      expect(readPublicState({
        status: 'waiting',
        winnings: null,
        finishReason: null,
        lifelines,
      })?.lifelines).toEqual(UNUSED_LIFELINES);
    },
  );

  it('returns each current lifeline result without returning extra fields', () => {
    const result = readLifelines('question_active', 5, {
      fiftyFifty: { used: true, usedAtPosition: 5, removed: [3, 1], extra: 'ignored' },
      phone: { used: true, usedAtPosition: 5, hint: 2, hintIsCorrect: true, extra: 'ignored' },
      audience: {
        used: true,
        usedAtPosition: 5,
        percentages: [10, 20, 30, 40],
        notEnoughVotes: true,
        extra: 'ignored',
      },
    });

    expect(result).toEqual({
      fiftyFifty: { used: true, usedAtPosition: 5, removed: [1, 3] },
      phone: { used: true, usedAtPosition: 5, hint: 2 },
      audience: {
        used: true,
        usedAtPosition: 5,
        percentages: [10, 20, 30, 40],
        notEnoughVotes: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('hintIsCorrect');
    expect(JSON.stringify(result)).not.toContain('extra');
  });

  it.each(['question_active', 'locked', 'revealed', 'finished'] as const)(
    'returns applicable results in %s',
    (status) => {
      expect(readLifelines(status, 4, {
        fiftyFifty: { used: true, usedAtPosition: 4, removed: [0, 3] },
        phone: { used: true, usedAtPosition: 4, hint: 1 },
        audience: {
          used: true,
          usedAtPosition: 4,
          percentages: [25, 25, 25, 25],
          notEnoughVotes: false,
        },
      })).toEqual({
        fiftyFifty: { used: true, usedAtPosition: 4, removed: [0, 3] },
        phone: { used: true, usedAtPosition: 4, hint: 1 },
        audience: {
          used: true,
          usedAtPosition: 4,
          percentages: [25, 25, 25, 25],
          notEnoughVotes: false,
        },
      });
    },
  );

  it.each([
    ['earlier position', 'question_active', 5, 4],
    ['different position', 'question_active', 5, 6],
    ['waiting state', 'waiting', null, 1],
  ] as const)(
    'hides results when they do not apply at the %s',
    (_description, status, position, usedAtPosition) => {
      expect(readLifelines(status, position, {
        fiftyFifty: { used: true, usedAtPosition, removed: [0, 1] },
        phone: { used: true, usedAtPosition, hint: 2 },
        audience: {
          used: true,
          usedAtPosition,
          percentages: [25, 25, 25, 25],
          notEnoughVotes: true,
        },
      })).toEqual({
        fiftyFifty: { used: true, usedAtPosition, removed: null },
        phone: { used: true, usedAtPosition, hint: null },
        audience: {
          used: true,
          usedAtPosition,
          percentages: null,
          notEnoughVotes: false,
        },
      });
    },
  );

  it('hides results when the lifeline is unused', () => {
    expect(readLifelines('question_active', 2, {
      fiftyFifty: { used: false, usedAtPosition: 2, removed: [0, 1] },
      phone: { used: false, usedAtPosition: 2, hint: 2 },
      audience: {
        used: false,
        usedAtPosition: 2,
        percentages: [25, 25, 25, 25],
        notEnoughVotes: true,
      },
    })).toEqual({
      fiftyFifty: { used: false, usedAtPosition: 2, removed: null },
      phone: { used: false, usedAtPosition: 2, hint: null },
      audience: {
        used: false,
        usedAtPosition: 2,
        percentages: null,
        notEnoughVotes: false,
      },
    });
  });

  it.each([
    [[0, 0]],
    [[0, 4]],
    [[-1, 2]],
    [[0, 1, 2]],
    [[0, 1.5]],
  ])('returns null for malformed removed options %s', (removed) => {
    expect(readLifelines('question_active', 2, {
      fiftyFifty: { used: true, usedAtPosition: 2, removed },
    })?.fiftyFifty.removed).toBeNull();
  });

  it.each([4, -1, '2', 1.5])('returns null for malformed phone hint %s', (hint) => {
    expect(readLifelines('question_active', 2, {
      phone: { used: true, usedAtPosition: 2, hint },
    })?.phone.hint).toBeNull();
  });

  it.each([
    [[25, 25, 25, 24]],
    [[25, 25, 25, 26]],
    [[101, 0, 0, 0]],
    [[-1, 34, 33, 34]],
    [[25, 25, 25]],
    [[25, 25, 25, 24.5]],
  ])('returns null for malformed audience percentages %s', (percentages) => {
    expect(readLifelines('question_active', 2, {
      audience: { used: true, usedAtPosition: 2, percentages },
    })?.audience.percentages).toBeNull();
  });

  it('returns false for a non boolean not enough votes value', () => {
    expect(readLifelines('question_active', 2, {
      audience: {
        used: true,
        usedAtPosition: 2,
        percentages: null,
        notEnoughVotes: 'true',
      },
    })?.audience.notEnoughVotes).toBe(false);
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
