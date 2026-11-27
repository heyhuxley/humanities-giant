import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import type { GameEvent, SessionState } from './types';

const host = { id: 'host', role: 'host' as const };
const player = { id: 'player', role: 'contestant' as const };
const system = { id: 'system', role: 'system' as const };
const run = (state: SessionState, event: GameEvent, now = 100) => applyEvent(state, event, now);
const resultState = (result: ReturnType<typeof applyEvent>): SessionState => {
  if (!result.ok) throw new Error(`Expected transition to succeed, got ${result.error}`);
  return result.state;
};
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
};
const active = (): SessionState => ({ ...createInitialState(), status: 'question_active', position: 1, contestantId: 'player', questionEndsAt: 100 });

describe('applyEvent transitions', () => {
  it('handles setup, answer, lock, reveal, next, walk away and end', () => {
    const s0 = createInitialState();
    const s1 = resultState(run(s0, { type: 'set_contestant', actor: host, participantId: 'player' }));
    const s2 = resultState(run(s1, { type: 'start', actor: host }, 10));
    const s3 = resultState(run(s2, { type: 'select_answer', actor: player, option: 2 }, 11));
    const s4 = resultState(run(s3, { type: 'lock_in', actor: player }, 12));
    const s5 = resultState(run(s4, { type: 'reveal', actor: host, correctIndex: 2 }));
    expect(s5.status).toBe('revealed');
    const s6 = resultState(run(s5, { type: 'next', actor: host }, 20));
    expect(s6.position).toBe(2);
    expect(resultState(run(s5, { type: 'walk_away', actor: player })).winnings).toBe(5_000);
    expect(resultState(run(s6, { type: 'end_session', actor: host })).winnings).toBe(5_000);
  });
  it('enforces guards and exact timer boundaries', () => {
    const s = active();
    expect(run(s, { type: 'select_answer', actor: player, option: 1 }, 99).ok).toBe(true);
    expect(run(s, { type: 'select_answer', actor: player, option: 1 }, 100)).toMatchObject({ ok: false, error: 'deadline_passed' });
    expect(run(s, { type: 'timer_expired', actor: system }, 99)).toMatchObject({ ok: false, error: 'too_early' });
    expect(resultState(run(s, { type: 'timer_expired', actor: system }, 100)).status).toBe('locked');
    expect(run(s, { type: 'start', actor: host })).toMatchObject({ ok: false, error: 'wrong_state' });
    expect(run(s, { type: 'lock_in', actor: { ...player, id: 'other' } })).toMatchObject({ ok: false, error: 'not_allowed' });
    expect(run(s, { type: 'use_lifeline', actor: player, lifeline: { lifeline: 'phone', hint: 4 as never, hintIsCorrect: false } }, 99)).toMatchObject({ ok: false, error: 'invalid_input' });
  });
  it('does not mutate frozen input and handles loss, timeout and final win', () => {
    const frozen = deepFreeze(active());
    expect(run(frozen, { type: 'select_answer', actor: player, option: 1 }, 99).ok).toBe(true);
    const loss: SessionState = { ...active(), status: 'locked', position: 6, lockedAnswer: 0 };
    expect(resultState(run(loss, { type: 'reveal', actor: host, correctIndex: 1 })).winnings).toBe(30_000);
    expect(resultState(run({ ...loss, lockedAnswer: null }, { type: 'reveal', actor: host, correctIndex: 1 })).finishReason).toBe('timeout');
    const win: SessionState = { ...loss, position: 15, lockedAnswer: 2 };
    expect(resultState(run(win, { type: 'reveal', actor: host, correctIndex: 2 })).winnings).toBe(500_000);
  });
});
