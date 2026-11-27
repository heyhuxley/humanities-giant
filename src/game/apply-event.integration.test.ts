import { describe, expect, it } from 'vitest';
import { applyEvent } from './apply-event';
import { createInitialState } from './initial-state';
import type { GameEvent, SessionState } from './types';

const host = { id: 'host', role: 'host' as const };
const player = { id: 'player', role: 'contestant' as const };
const stateOf = (result: ReturnType<typeof applyEvent>): SessionState => {
  if (!result.ok) throw new Error(`Unexpected rejection: ${result.error}`);
  return result.state;
};
const send = (state: SessionState, event: GameEvent, now = 100) => stateOf(applyEvent(state, event, now));
const begin = (): SessionState => send({ ...createInitialState(), contestantId: 'player' }, { type: 'start', actor: host }, 0);
const lifeline = (state: SessionState, event: Extract<GameEvent, { type: 'use_lifeline' }>): SessionState => send(state, event, 101);
const answer = (state: SessionState, option: 0 | 1 | 2 | 3, correct: 0 | 1 | 2 | 3): SessionState => {
  let current = send(state, { type: 'select_answer', actor: player, option }, 102);
  current = send(current, { type: 'lock_in', actor: player }, 103);
  current = send(current, { type: 'reveal', actor: host, correctIndex: correct }, 104);
  return current;
};
const advance = (state: SessionState): SessionState => send(state, { type: 'next', actor: host }, 105);

describe('full game integrations', () => {
  it('uses all lifelines at different positions and wins', () => {
    let state = lifeline(begin(), { type: 'use_lifeline', actor: player, lifeline: { lifeline: 'fifty_fifty', remove: [0, 2] } });
    state = advance(answer(state, 1, 1));
    state = advance(answer(state, 1, 1));
    state = lifeline(state, { type: 'use_lifeline', actor: player, lifeline: { lifeline: 'phone', hint: 1, hintIsCorrect: true } });
    state = advance(answer(state, 1, 1));
    state = advance(answer(state, 1, 1));
    state = lifeline(state, { type: 'use_lifeline', actor: player, lifeline: { lifeline: 'audience', voteCounts: [3, 1, 0, 0] } });
    for (let position = 5; position <= 15; position += 1) {
      state = answer(state, 1, 1);
      if (position < 15) state = advance(state);
    }
    expect(state).toMatchObject({ status: 'finished', position: 15, finishReason: 'won', winnings: 500_000 });
    expect(state.lifelines.fiftyFifty.usedAtPosition).toBe(1);
    expect(state.lifelines.phone.usedAtPosition).toBe(3);
    expect(state.lifelines.audience.usedAtPosition).toBe(5);
  });

  it('finishes wrong at position seven with the fifth question milestone', () => {
    let state = begin();
    for (let position = 1; position <= 7; position += 1) {
      state = answer(state, position === 7 ? 0 : 1, 1);
      if (position < 7) state = advance(state);
    }
    expect(state).toMatchObject({ status: 'finished', position: 7, finishReason: 'wrong', winnings: 30_000 });
  });

  it('walks away at position ten after using lifelines', () => {
    let state = begin();
    state = lifeline(state, { type: 'use_lifeline', actor: player, lifeline: { lifeline: 'phone', hint: 1, hintIsCorrect: true } });
    for (let position = 1; position <= 10; position += 1) {
      state = answer(state, 1, 1);
      if (position < 10) state = advance(state);
      if (position === 4) state = lifeline(state, { type: 'use_lifeline', actor: player, lifeline: { lifeline: 'fifty_fifty', remove: [0, 2] } });
    }
    state = send(state, { type: 'walk_away', actor: player });
    expect(state).toMatchObject({ status: 'finished', finishReason: 'walked_away', winnings: 100_000 });
    expect(state.lifelines.phone.usedAtPosition).toBe(1);
    expect(state.lifelines.fiftyFifty.usedAtPosition).toBe(5);
  });

  it('times out at position three and pays zero', () => {
    let state = begin();
    for (let position = 1; position < 3; position += 1) state = advance(answer(state, 1, 1));
    state = send(state, { type: 'timer_expired', actor: { id: 'system', role: 'system' } }, 30_105);
    state = send(state, { type: 'reveal', actor: host, correctIndex: 1 });
    expect(state).toMatchObject({ status: 'finished', position: 3, finishReason: 'timeout', winnings: 0 });
  });

  it('ends by host at position twelve and retains position eleven winnings', () => {
    let state = begin();
    for (let position = 1; position < 12; position += 1) state = advance(answer(state, 1, 1));
    state = send(state, { type: 'end_session', actor: host });
    expect(state).toMatchObject({ status: 'finished', position: 12, finishReason: 'ended_by_host', winnings: 150_000 });
  });
});
