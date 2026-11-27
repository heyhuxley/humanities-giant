import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import type { GameEvent, LifelineEvent, Lifelines, SessionState } from './types';

const player = { id: 'player', role: 'contestant' as const };
const deepFreeze = <T,>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
};
const active = (position = 4): SessionState => ({ ...createInitialState(), status: 'question_active', position, contestantId: 'player', questionEndsAt: 100 });
type UseEvent = Extract<GameEvent, { type: 'use_lifeline' }>;
const use = (state: SessionState, lifeline: UseEvent, now = 99) => applyEvent(deepFreeze(state), lifeline, now);
const event = (lifeline: LifelineEvent): UseEvent => ({ type: 'use_lifeline', actor: player, lifeline });
const stateOf = (result: ReturnType<typeof applyEvent>): SessionState => {
  if (!result.ok) throw new Error(`Expected success, got ${result.error}`);
  return result.state;
};

describe('use_lifeline', () => {
  it.each([
    { lifeline: { lifeline: 'fifty_fifty', remove: [0, 2] }, key: 'fiftyFifty' },
    { lifeline: { lifeline: 'phone', hint: 3, hintIsCorrect: false }, key: 'phone' },
    { lifeline: { lifeline: 'audience', voteCounts: [1, 1, 1, 0] }, key: 'audience' },
  ] as { lifeline: LifelineEvent; key: keyof Lifelines }[])('stores $key result at current position', ({ lifeline, key }) => {
    const result = stateOf(use(active(7), event(lifeline)));
    expect(result.status).toBe('question_active');
    if (key === 'fiftyFifty') expect(result.lifelines.fiftyFifty).toMatchObject({ used: true, usedAtPosition: 7 });
    if (key === 'phone') expect(result.lifelines.phone).toMatchObject({ used: true, usedAtPosition: 7 });
    if (key === 'audience') expect(result.lifelines.audience).toMatchObject({ used: true, usedAtPosition: 7 });
    if (key === 'fiftyFifty') expect(result.lifelines.fiftyFifty.removed).toEqual([0, 2]);
    if (key === 'phone') expect(result.lifelines.phone).toMatchObject({ hint: 3, hintIsCorrect: false });
    if (key === 'audience') expect(result.lifelines.audience).toMatchObject({ percentages: [34, 33, 33, 0], notEnoughVotes: false });
  });

  it.each([
    { lifeline: { lifeline: 'fifty_fifty', remove: [0, 2] }, key: 'fiftyFifty' },
    { lifeline: { lifeline: 'phone', hint: 3, hintIsCorrect: false }, key: 'phone' },
    { lifeline: { lifeline: 'audience', voteCounts: [1, 1, 1, 0] }, key: 'audience' },
  ] as { lifeline: LifelineEvent; key: keyof Lifelines }[])('rejects a second $key use, including on a later question', ({ lifeline, key }) => {
    expect(key).toBe(lifeline.lifeline === 'fifty_fifty' ? 'fiftyFifty' : lifeline.lifeline === 'phone' ? 'phone' : 'audience');
    const first = stateOf(use(active(), event(lifeline)));
    const later = { ...first, status: 'question_active' as const, position: 5, questionEndsAt: 100 };
    expect(use(later, event(lifeline))).toEqual({ ok: false, error: 'lifeline_used' });
  });

  it('preserves earlier lifeline data through next and allows different lifelines in sequence', () => {
    const first = stateOf(use(active(), event({ lifeline: 'phone', hint: 2, hintIsCorrect: true })));
    const revealed: SessionState = { ...first, status: 'revealed', lastResult: 'correct', lockedAnswer: 1, correctIndex: 1 };
    const next = stateOf(applyEvent(revealed, { type: 'next', actor: { id: 'host', role: 'host' } }, 200));
    expect(next.lifelines.phone).toMatchObject({ used: true, usedAtPosition: 4, hint: 2, hintIsCorrect: true });
    const second = stateOf(use(next, event({ lifeline: 'fifty_fifty', remove: [0, 3] }), 201));
    expect(second.lifelines.fiftyFifty).toMatchObject({ used: true, usedAtPosition: 5, removed: [0, 3] });
  });

  it.each(['waiting', 'locked', 'revealed', 'finished'] as const)('rejects state %s', (status) => {
    const state = deepFreeze({ ...active(), status });
    expect(applyEvent(state, event({ lifeline: 'phone', hint: 1, hintIsCorrect: true }), 99)).toEqual({ ok: false, error: 'wrong_state' });
  });
  it('rejects wrong role and contestant id', () => {
    expect(applyEvent(deepFreeze(active()), { type: 'use_lifeline', actor: { id: 'host', role: 'host' }, lifeline: { lifeline: 'phone', hint: 1, hintIsCorrect: true } }, 99)).toEqual({ ok: false, error: 'not_allowed' });
    expect(applyEvent(deepFreeze(active()), { type: 'use_lifeline', actor: { id: 'other', role: 'contestant' }, lifeline: { lifeline: 'phone', hint: 1, hintIsCorrect: true } }, 99)).toEqual({ ok: false, error: 'not_allowed' });
  });
  it.each([100, 101])('rejects use at time %i and accepts one ms before', (now) => {
    expect(applyEvent(deepFreeze(active()), event({ lifeline: 'phone', hint: 1, hintIsCorrect: true }), now)).toEqual({ ok: false, error: 'deadline_passed' });
    expect(use(active(), event({ lifeline: 'phone', hint: 1, hintIsCorrect: true }), 99).ok).toBe(true);
  });
  it('applies guard order for used and deadline conditions', () => {
    const used = { ...active(), lifelines: { ...createInitialState().lifelines, phone: { used: true, usedAtPosition: 1, hint: 0 as const, hintIsCorrect: true } } };
    expect(use(used, event({ lifeline: 'phone', hint: 9 as never, hintIsCorrect: true }))).toEqual({ ok: false, error: 'lifeline_used' });
    expect(applyEvent(deepFreeze(used), event({ lifeline: 'phone', hint: 1, hintIsCorrect: true }), 100)).toEqual({ ok: false, error: 'deadline_passed' });
  });
  it.each([
    { label: 'duplicate removals', lifeline: { lifeline: 'fifty_fifty', remove: [1, 1] } },
    { label: 'out of range removal', lifeline: { lifeline: 'fifty_fifty', remove: [1, 4] } },
    { label: 'out of range hint', lifeline: { lifeline: 'phone', hint: 4, hintIsCorrect: true } },
    { label: 'non boolean hint result', lifeline: { lifeline: 'phone', hint: 1, hintIsCorrect: 'yes' } },
    { label: 'wrong vote count length', lifeline: { lifeline: 'audience', voteCounts: [1, 2, 3] } },
    { label: 'negative vote count', lifeline: { lifeline: 'audience', voteCounts: [1, -1, 3, 0] } },
    { label: 'fractional vote count', lifeline: { lifeline: 'audience', voteCounts: [1, 1.5, 3, 0] } },
  ])('rejects $label', ({ lifeline }) => {
    expect(applyEvent(deepFreeze(active()), { type: 'use_lifeline', actor: player, lifeline } as never, 99)).toEqual({ ok: false, error: 'invalid_input' });
  });
  it('spends audience lifeline when there are too few votes', () => {
    const result = stateOf(use(active(), event({ lifeline: 'audience', voteCounts: [1, 1, 0, 0] })));
    expect(result.lifelines.audience).toMatchObject({ used: true, usedAtPosition: 4, percentages: null, notEnoughVotes: true });
  });
});
