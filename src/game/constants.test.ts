import { describe, expect, it } from 'vitest';
import { MONEY_LADDER, MILESTONE_QUESTIONS } from './constants';
import { createInitialState } from './initial-state';

describe('game constants and initial state', () => {
  it('defines an increasing 15 question ladder ending at 500000', () => {
    expect(MONEY_LADDER).toHaveLength(15);
    expect(MONEY_LADDER.at(-1)).toBe(500_000);
    expect(MONEY_LADDER.every((amount, index) => index === 0 || amount > MONEY_LADDER[index - 1])).toBe(true);
  });
  it('defines milestone questions 5 and 10', () => {
    expect(MILESTONE_QUESTIONS).toEqual([5, 10]);
  });
  it('creates a fresh waiting state with unused lifelines', () => {
    const state = createInitialState();
    expect(state.status).toBe('waiting');
    expect(state.position).toBe(0);
    expect(state.contestantId).toBeNull();
    expect(state.lifelines.fiftyFifty.used).toBe(false);
    expect(state.lifelines.phone.used).toBe(false);
    expect(state.lifelines.audience.used).toBe(false);
    expect(createInitialState()).not.toBe(state);
  });
});
