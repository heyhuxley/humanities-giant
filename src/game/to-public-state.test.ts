import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import { toPublicState } from './to-public-state';
import type { GameEvent, SessionState } from './types';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const populated = (hintIsCorrect: boolean | null): SessionState => ({
  ...createInitialState(), status: 'finished', position: 5, contestantId: 'player', winnings: 30_000, finishReason: 'wrong',
  correctIndex: 2, lastResult: 'wrong',
  lifelines: {
    fiftyFifty: { used: true, usedAtPosition: 2, removed: [0, 1] },
    phone: { used: true, usedAtPosition: 3, hint: 2, hintIsCorrect },
    audience: { used: true, usedAtPosition: 4, percentages: [25, 25, 25, 25], notEnoughVotes: false },
  },
});

function stripHint(value: SessionState | ReturnType<typeof toPublicState>): unknown {
  const copy = structuredClone(value) as Record<string, unknown>;
  const lifelines = copy.lifelines as Record<string, Record<string, unknown>>;
  delete lifelines.phone.hintIsCorrect;
  return copy;
}

function differingPaths(left: unknown, right: unknown, prefix = ''): string[] {
  if (Object.is(left, right)) return [];
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return [prefix];
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => differingPaths(a[key], b[key], prefix ? `${prefix}.${key}` : key));
}

describe('toPublicState', () => {
  it.each([true, false])('redacts phone correctness when the value is %s', (hintIsCorrect) => {
    const state = populated(hintIsCorrect);
    expect(toPublicState(state).lifelines.phone.hintIsCorrect).toBeNull();
  });
  it('keeps an unused phone result unchanged', () => {
    const state = createInitialState();
    expect(toPublicState(state).lifelines.phone).toEqual(state.lifelines.phone);
  });
  it('preserves every other field and does not mutate or share lifeline objects', () => {
    const state = deepFreeze(populated(true));
    const result = toPublicState(state);
    expect(stripHint(result)).toEqual(stripHint(state));
    expect(result).not.toBe(state);
    expect(result.lifelines).not.toBe(state.lifelines);
    expect(result.lifelines.fiftyFifty).not.toBe(state.lifelines.fiftyFifty);
    expect(result.lifelines.phone).not.toBe(state.lifelines.phone);
    expect(result.lifelines.audience).not.toBe(state.lifelines.audience);
    expect(state.lifelines.phone.hintIsCorrect).toBe(true);
  });
  it('contains no non null hintIsCorrect property at any depth', () => {
    const result = toPublicState(populated(false));
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'hintIsCorrect') expect(child).toBeNull();
        visit(child);
      }
    };
    visit(result);
  });
  it('changes only the pinned phone hint field after a finished reveal', () => {
    let state: SessionState = { ...createInitialState(), contestantId: 'player' };
    const events: GameEvent[] = [
      { type: 'start', actor: { id: 'host', role: 'host' } },
      { type: 'use_lifeline', actor: { id: 'player', role: 'contestant' }, lifeline: { lifeline: 'fifty_fifty', remove: [0, 1] } },
      { type: 'use_lifeline', actor: { id: 'player', role: 'contestant' }, lifeline: { lifeline: 'phone', hint: 2, hintIsCorrect: true } },
      { type: 'use_lifeline', actor: { id: 'player', role: 'contestant' }, lifeline: { lifeline: 'audience', voteCounts: [1, 1, 1, 0] } },
      { type: 'select_answer', actor: { id: 'player', role: 'contestant' }, option: 0 },
      { type: 'lock_in', actor: { id: 'player', role: 'contestant' } },
      { type: 'reveal', actor: { id: 'host', role: 'host' }, correctIndex: 2 },
    ];
    for (const event of events) {
      const result = applyEvent(state, event, 1);
      if (!result.ok) throw new Error(`Expected setup event to succeed, got ${result.error}`);
      state = result.state;
    }
    expect(state.status).toBe('finished');
    expect(state.lifelines.phone.hintIsCorrect).not.toBeNull();
    expect(differingPaths(state, toPublicState(state))).toEqual(['lifelines.phone.hintIsCorrect']);
  });
});
