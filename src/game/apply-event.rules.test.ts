import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import { MONEY_LADDER, QUESTION_DURATION_MS } from './constants';
import type { GameEvent, Option, SessionState } from './types';

const host = { id: 'host', role: 'host' as const };
const player = { id: 'player', role: 'contestant' as const };
const deepFreeze = <T,>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};
const stateFor = (status: SessionState['status'], position: number): SessionState => ({
  ...createInitialState(), status, position, contestantId: 'player',
  questionEndsAt: status === 'question_active' ? 200 : null,
  selectedAnswer: status === 'question_active' ? 1 : null,
  lockedAnswer: status === 'locked' || status === 'revealed' ? 1 : null,
  correctIndex: status === 'revealed' ? 1 : null,
  lastResult: status === 'revealed' ? 'correct' : null,
});
const successState = (state: SessionState, event: GameEvent, now: number): SessionState => {
  const frozen = deepFreeze(state);
  const result = applyEvent(frozen, event, now);
  if (!result.ok) throw new Error(`Expected success, received ${result.error}`);
  expect(result.state).not.toBe(state);
  return result.state;
};

describe('applyEvent timer rules', () => {
  it.each(['select_answer', 'lock_in'] as const)('%s enforces the before deadline boundary', (type) => {
    const event: GameEvent = type === 'select_answer' ? { type, actor: player, option: 2 } : { type, actor: player };
    expect(successState(stateFor('question_active', 1), event, 199).status).toBe(type === 'lock_in' ? 'locked' : 'question_active');
    for (const now of [200, 201]) {
      const state = deepFreeze(stateFor('question_active', 1));
      expect(applyEvent(state, event, now)).toEqual({ ok: false, error: 'deadline_passed' });
      expect(state.questionEndsAt).toBe(200);
    }
  });
  it.each([{ now: 199, error: 'too_early' }, { now: 200 }, { now: 201 }])('timer expiration at $now', ({ now, error }) => {
    const state = deepFreeze(stateFor('question_active', 1));
    const result = applyEvent(state, { type: 'timer_expired', actor: { id: 'system', role: 'system' } }, now);
    if (error) expect(result).toEqual({ ok: false, error });
    else {
      expect(result).toMatchObject({ ok: true, state: { status: 'locked', lockedAnswer: null } });
    }
    expect(state.status).toBe('question_active');
  });
});

interface RevealCase {
  label: string; position: number; lockedAnswer: Option | null; correctIndex: Option;
  status: 'revealed' | 'finished'; finishReason: SessionState['finishReason'];
  winnings: number | null; lastResult: SessionState['lastResult'];
}
const revealCases: RevealCase[] = [
  ...[5, 10].map((position): RevealCase => ({ label: `correct at ${position}`, position, lockedAnswer: 1, correctIndex: 1, status: 'revealed', finishReason: null, winnings: null, lastResult: 'correct' })),
  ...[1, 5, 6, 10, 11, 14].map((position, index): RevealCase => ({ label: `wrong at ${position}`, position, lockedAnswer: 0, correctIndex: 1, status: 'finished', finishReason: 'wrong', winnings: [0, 0, 30_000, 30_000, 100_000, 100_000][index], lastResult: 'wrong' })),
  ...[1, 5, 6, 10, 11, 14].map((position, index): RevealCase => ({ label: `timeout at ${position}`, position, lockedAnswer: null, correctIndex: 1, status: 'finished', finishReason: 'timeout', winnings: [0, 0, 30_000, 30_000, 100_000, 100_000][index], lastResult: 'timeout' })),
  { label: 'wrong at 15', position: 15, lockedAnswer: 0, correctIndex: 1, status: 'finished', finishReason: 'wrong', winnings: 100_000, lastResult: 'wrong' },
  { label: 'correct at 15', position: 15, lockedAnswer: 1, correctIndex: 1, status: 'finished', finishReason: 'won', winnings: 500_000, lastResult: 'correct' },
];

describe('applyEvent reveal outcomes', () => {
  it.each(revealCases)('$label', ({ position, lockedAnswer, correctIndex, status, finishReason, winnings, lastResult }) => {
    const state: SessionState = deepFreeze({ ...stateFor('locked', position), lockedAnswer });
    const result = applyEvent(state, { type: 'reveal', actor: host, correctIndex }, 0);
    expect(result).toMatchObject({ ok: true, state: { status, finishReason, winnings, lastResult, correctIndex } });
    expect(state.status).toBe('locked');
  });
});

describe('applyEvent finish winnings', () => {
  it.each([1, 5, 10, 14])('walk away at position %i pays the ladder amount', (position) => {
    const result = successState(stateFor('revealed', position), { type: 'walk_away', actor: player }, 0);
    expect(result.winnings).toBe(MONEY_LADDER[position - 1]);
  });
  it.each([
    { status: 'waiting', position: 0, expected: 0 },
    { status: 'question_active', position: 1, expected: 0 },
    { status: 'question_active', position: 6, expected: MONEY_LADDER[4] },
    { status: 'locked', position: 1, expected: 0 },
    { status: 'locked', position: 11, expected: MONEY_LADDER[9] },
    { status: 'revealed', position: 1, expected: MONEY_LADDER[0] },
    { status: 'revealed', position: 10, expected: MONEY_LADDER[9] },
  ] as const)('end session from $status at position $position', ({ status, position, expected }) => {
    const result = successState(stateFor(status, position), { type: 'end_session', actor: host }, 0);
    expect(result.finishReason).toBe('ended_by_host');
    expect(result.winnings).toBe(expected);
  });
});

describe('applyEvent deadlines and clearing', () => {
  it('starts at position 1 and sets the supplied deadline', () => {
    const state = { ...stateFor('waiting', 0), contestantId: 'player' };
    expect(successState(state, { type: 'start', actor: host }, 123).questionEndsAt).toBe(123 + QUESTION_DURATION_MS);
  });
  it('advances with cleared answer fields and unchanged lifelines', () => {
    const state: SessionState = { ...stateFor('revealed', 4), selectedAnswer: 0, lockedAnswer: 0, correctIndex: 0, lifelines: { ...createInitialState().lifelines, phone: { used: true, usedAtPosition: 2, hint: 3, hintIsCorrect: false } } };
    const result = successState(state, { type: 'next', actor: host }, 321);
    expect(result).toMatchObject({ position: 5, questionEndsAt: 321 + QUESTION_DURATION_MS, selectedAnswer: null, lockedAnswer: null, correctIndex: null, lastResult: null });
    expect(result.lifelines).toEqual(state.lifelines);
  });
  it('runs a full fifteen question round to the win', () => {
    let state: SessionState = { ...createInitialState(), contestantId: 'player' };
    state = successState(state, { type: 'start', actor: host }, 0);
    for (let position = 1; position <= 15; position += 1) {
      state = successState(state, { type: 'select_answer', actor: player, option: 1 }, 1);
      state = successState(state, { type: 'lock_in', actor: player }, 2);
      state = successState(state, { type: 'reveal', actor: host, correctIndex: 1 }, 3);
      if (position < 15) state = successState(state, { type: 'next', actor: host }, position * 10);
    }
    expect(state).toMatchObject({ status: 'finished', position: 15, finishReason: 'won', winnings: 500_000 });
  });
});

describe('applyEvent guard order', () => {
  it('checks state before actor and deadline before payload', () => {
    const wrongStatus = deepFreeze(stateFor('waiting', 0));
    expect(applyEvent(wrongStatus, { type: 'select_answer', actor: host, option: 1 }, 201)).toEqual({ ok: false, error: 'wrong_state' });
    const afterDeadline = deepFreeze(stateFor('question_active', 1));
    expect(applyEvent(afterDeadline, { type: 'lock_in', actor: host }, 200)).toEqual({ ok: false, error: 'not_allowed' });
    const emptySelection = deepFreeze({ ...stateFor('question_active', 1), selectedAnswer: null });
    expect(applyEvent(emptySelection, { type: 'lock_in', actor: player }, 200)).toEqual({ ok: false, error: 'deadline_passed' });
  });
});
