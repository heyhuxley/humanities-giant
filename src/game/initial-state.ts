import type { SessionState } from './types';

export function createInitialState(): SessionState {
  return {
    status: 'waiting', position: 0, contestantId: null, questionEndsAt: null,
    selectedAnswer: null, lockedAnswer: null, correctIndex: null, lastResult: null,
    lifelines: {
      fiftyFifty: { used: false, usedAtPosition: null, removed: null },
      phone: { used: false, usedAtPosition: null, hint: null, hintIsCorrect: null },
      audience: { used: false, usedAtPosition: null, percentages: null, notEnoughVotes: false },
    },
    winnings: null, finishReason: null,
  };
}
