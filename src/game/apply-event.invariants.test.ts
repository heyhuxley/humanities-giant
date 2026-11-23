import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import { MONEY_LADDER } from './constants';
import type { GameEvent, Option, SessionState } from './types';

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function makeEvent(random: () => number): GameEvent {
  const role = Math.floor(random() * 4);
  const actor = role === 0 ? { id: 'host', role: 'host' as const }
    : role === 1 ? { id: 'player', role: 'contestant' as const }
      : role === 2 ? { id: 'other', role: 'contestant' as const }
        : { id: 'system', role: 'system' as const };
  const option = (): number => Math.floor(random() * 6) - 1;
  const type = Math.floor(random() * 10);
  if (type === 0) return { type: 'set_contestant', actor, participantId: random() < 0.1 ? '' : 'player' } as GameEvent;
  if (type === 1) return { type: 'start', actor };
  if (type === 2) return { type: 'select_answer', actor, option: option() as Option };
  if (type === 3) return { type: 'lock_in', actor };
  if (type === 4) return { type: 'timer_expired', actor };
  if (type === 5) return { type: 'reveal', actor, correctIndex: option() as Option };
  if (type === 6) return { type: 'next', actor };
  if (type === 7) return { type: 'walk_away', actor };
  if (type === 8) return { type: 'end_session', actor };
  const variant = Math.floor(random() * 3);
  const lifeline = variant === 0
    ? { lifeline: 'fifty_fifty', remove: random() < 0.5 ? [option(), option()] : [0, 1] }
    : variant === 1
      ? { lifeline: 'phone', hint: option(), hintIsCorrect: random() < 0.5 ? true : 'bad' }
      : { lifeline: 'audience', voteCounts: random() < 0.5 ? [Math.floor(random() * 5), 1, 0, 2] : [1, 2] };
  return { type: 'use_lifeline', actor, lifeline } as never;
}

describe('engine invariants under seeded event sequences', () => {
  it('holds invariants across at least 2000 random sequences', () => {
    const seed = 0x51ced;
    const random = mulberry32(seed);
    let eventCount = 0;
    for (let sequence = 0; sequence < 2000; sequence += 1) {
      let state: SessionState = { ...createInitialState(), contestantId: 'player' };
      let revealOccurred = false;
      for (let index = 0, length = Math.floor(random() * 61); index < length; index += 1) {
        const event = makeEvent(random);
        const deadline = state.questionEndsAt;
        const now = deadline === null ? Math.floor(random() * 1000) : [deadline - 1, deadline, deadline + 1, Math.floor(random() * 1000)][Math.floor(random() * 4)];
        const input = deepFreeze(state);
        const before = JSON.stringify(input);
        let result: ReturnType<typeof applyEvent>;
        try {
          result = applyEvent(input, event, now);
        } catch (error) {
          throw new Error(`seed ${seed}, sequence ${sequence}, event ${index}: threw ${String(error)}`);
        }
        eventCount += 1;
        expect(JSON.stringify(input), `seed ${seed}, sequence ${sequence}, event ${index}: mutated input`).toBe(before);
        if (!result.ok) {
          expect(input, `seed ${seed}, sequence ${sequence}, event ${index}: rejection mutated state`).toBe(state);
          expect(result.error, `seed ${seed}, sequence ${sequence}, event ${index}: bad rejection`).toBeTruthy();
          expect(result, `seed ${seed}, sequence ${sequence}, event ${index}: rejected result identity`).toBeDefined();
          if (state.status === 'finished') expect(result.error, `seed ${seed}, sequence ${sequence}, event ${index}: finished accepted`).toBe('wrong_state');
        } else {
          if (event.type === 'reveal') revealOccurred = true;
          expect(result.state.position, `seed ${seed}, sequence ${sequence}, event ${index}: position decreased`).toBeGreaterThanOrEqual(state.position);
          expect(result.state.position, `seed ${seed}, sequence ${sequence}, event ${index}: position exceeds 15`).toBeLessThanOrEqual(15);
          if (result.state.status !== 'finished') expect(result.state.winnings, `seed ${seed}, sequence ${sequence}, event ${index}: premature winnings`).toBeNull();
          if (!revealOccurred) expect(result.state.correctIndex, `seed ${seed}, sequence ${sequence}, event ${index}: answer exposed before reveal`).toBeNull();
          for (const key of ['fiftyFifty', 'phone', 'audience'] as const) {
            if (state.lifelines[key].used) expect(result.state.lifelines[key].used, `seed ${seed}, sequence ${sequence}, event ${index}: lifeline reset`).toBe(true);
          }
          if (result.state.winnings !== null) expect([0, 30_000, 100_000, 500_000, ...MONEY_LADDER], `seed ${seed}, sequence ${sequence}, event ${index}: invalid winnings`).toContain(result.state.winnings);
          state = result.state;
        }
      }
    }
    expect(eventCount).toBeGreaterThan(0);
  }, 30_000);
});
