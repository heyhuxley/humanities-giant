import type { PublicSessionState, SessionState } from './types';

export function toPublicState(state: SessionState): PublicSessionState {
  return {
    ...state,
    lifelines: {
      fiftyFifty: { ...state.lifelines.fiftyFifty },
      phone: { ...state.lifelines.phone, hintIsCorrect: null },
      audience: { ...state.lifelines.audience },
    },
  };
}
