import { describe, expect, it } from 'vitest';
import {
  describeFinishReason,
  describeResult,
  optionStates,
} from './reveal-view';

describe('optionStates', () => {
  it.each([
    ['no answer yet', { lockedAnswer: null, correctIndex: null, revealed: false }, ['neutral', 'neutral', 'neutral', 'neutral']],
    ['locked before reveal', { lockedAnswer: 1, correctIndex: 2, revealed: false }, ['neutral', 'locked', 'neutral', 'neutral']],
    ['correct locked answer', { lockedAnswer: 2, correctIndex: 2, revealed: true }, ['neutral', 'neutral', 'correct', 'neutral']],
    ['wrong locked answer', { lockedAnswer: 0, correctIndex: 2, revealed: true }, ['wrong', 'neutral', 'correct', 'neutral']],
    ['timeout with a revealed answer', { lockedAnswer: null, correctIndex: 2, revealed: true }, ['neutral', 'neutral', 'correct', 'neutral']],
    ['reveal missing answer index', { lockedAnswer: 1, correctIndex: null, revealed: true }, ['neutral', 'locked', 'neutral', 'neutral']],
  ] as const)('returns states for %s', (_label, input, expectedStates) => {
    const result = optionStates(input);
    expect(result.map((option) => option.state)).toEqual(expectedStates);
    expect(result.filter((option) => option.state === 'correct')).toHaveLength(
      input.revealed && input.correctIndex !== null ? 1 : 0,
    );
  });

  it('labels and marks the correct option', () => {
    expect(optionStates({
      lockedAnswer: 2,
      correctIndex: 2,
      revealed: true,
    })).toEqual([
      { state: 'neutral', icon: '', label: '' },
      { state: 'neutral', icon: '', label: '' },
      { state: 'correct', icon: '✓', label: 'Correct' },
      { state: 'neutral', icon: '', label: '' },
    ]);
  });

  it('labels a locked option before reveal', () => {
    expect(optionStates({
      lockedAnswer: 1,
      correctIndex: null,
      revealed: false,
    })[1]).toEqual({ state: 'locked', icon: '●', label: 'Locked in' });
  });

  it('labels a wrong locked option after reveal', () => {
    expect(optionStates({
      lockedAnswer: 0,
      correctIndex: 2,
      revealed: true,
    })[0]).toEqual({ state: 'wrong', icon: '✗', label: 'Wrong' });
  });

  it('does not mark an answer when the revealed state has no answer index', () => {
    expect(optionStates({
      lockedAnswer: 1,
      correctIndex: null,
      revealed: true,
    }).map((option) => option.state)).toEqual(['neutral', 'locked', 'neutral', 'neutral']);
  });
});

describe('describeResult', () => {
  it.each([
    ['correct', 'contestant', 'Correct!'],
    ['wrong', 'contestant', 'Wrong answer.'],
    ['timeout', 'contestant', 'Time ran out.'],
    ['correct', 'audience', 'The contestant got it right.'],
    ['wrong', 'audience', 'The contestant got it wrong.'],
    ['timeout', 'audience', 'Time ran out.'],
  ] as const)('describes %s for the %s', (lastResult, role, message) => {
    expect(describeResult({ lastResult, role })).toBe(message);
  });

  it.each(['contestant', 'audience'] as const)('returns null for no result as %s', (role) => {
    expect(describeResult({ lastResult: null, role })).toBeNull();
  });
});

describe('describeFinishReason', () => {
  it.each([
    ['won', 'Top prize won'],
    ['wrong', 'Wrong answer'],
    ['timeout', 'Time ran out'],
    ['walked_away', 'Walked away'],
    ['ended_by_host', 'Ended by the host'],
    [null, 'Game finished'],
    ['unknown', 'Game finished'],
  ] as const)('describes %s', (reason, message) => {
    expect(describeFinishReason(reason)).toBe(message);
  });
});
