import { getWinningsOnLoss, MONEY_LADDER, QUESTION_DURATION_MS } from './constants';
import type { GameError, GameEvent, GameResult, SessionState } from './types';

const reject = (error: GameError): GameResult => ({ ok: false, error });
const accept = (state: SessionState): GameResult => ({ ok: true, state });

export function applyEvent(state: SessionState, event: GameEvent, now: number): GameResult {
  if (event.type === 'use_lifeline') {
    // Lifelines are implemented in slice 1c.
    return reject('invalid_input');
  }
  const allowed: Record<Exclude<GameEvent['type'], 'use_lifeline'>, SessionState['status'][]> = {
    set_contestant: ['waiting'], start: ['waiting'], select_answer: ['question_active'],
    lock_in: ['question_active'], timer_expired: ['question_active'], reveal: ['locked'],
    next: ['revealed'], walk_away: ['revealed'], end_session: ['waiting', 'question_active', 'locked', 'revealed'],
  };
  if (!allowed[event.type].includes(state.status)) return reject('wrong_state');
  const actorAllowed = event.type === 'timer_expired'
    ? event.actor.role === 'system'
    : ['set_contestant', 'start', 'reveal', 'next', 'end_session'].includes(event.type)
      ? event.actor.role === 'host'
      : event.actor.role === 'contestant' && event.actor.id === state.contestantId;
  if (!actorAllowed) return reject('not_allowed');
  if ((event.type === 'select_answer' || event.type === 'lock_in') && now >= (state.questionEndsAt ?? Infinity)) return reject('deadline_passed');
  if (event.type === 'timer_expired' && now < (state.questionEndsAt ?? -Infinity)) return reject('too_early');
  if (event.type === 'start' && state.contestantId === null) return reject('no_contestant');
  if (event.type === 'set_contestant' && event.participantId.length === 0) return reject('invalid_input');
  if (event.type === 'lock_in' && state.selectedAnswer === null) return reject('nothing_selected');
  if ((event.type === 'select_answer' || event.type === 'reveal') && ![0, 1, 2, 3].includes(event.type === 'select_answer' ? event.option : event.correctIndex)) return reject('invalid_input');

  switch (event.type) {
    case 'set_contestant': return accept({ ...state, contestantId: event.participantId });
    case 'start': return accept({ ...state, status: 'question_active', position: 1, questionEndsAt: now + QUESTION_DURATION_MS });
    case 'select_answer': return accept({ ...state, selectedAnswer: event.option });
    case 'lock_in': return accept({ ...state, status: 'locked', lockedAnswer: state.selectedAnswer });
    case 'timer_expired': return accept({ ...state, status: 'locked', lockedAnswer: null });
    case 'reveal': {
      const result = state.lockedAnswer === null ? 'timeout' : state.lockedAnswer === event.correctIndex ? 'correct' : 'wrong';
      if (result === 'correct' && state.position < 15) return accept({ ...state, status: 'revealed', correctIndex: event.correctIndex, lastResult: result });
      return accept({ ...state, status: 'finished', correctIndex: event.correctIndex, lastResult: result,
        finishReason: result === 'correct' ? 'won' : result, winnings: result === 'correct' ? 500_000 : getWinningsOnLoss(state.position) });
    }
    case 'next': return accept({ ...state, status: 'question_active', position: state.position + 1, questionEndsAt: now + QUESTION_DURATION_MS, selectedAnswer: null, lockedAnswer: null, correctIndex: null, lastResult: null });
    case 'walk_away': return accept({ ...state, status: 'finished', finishReason: 'walked_away', winnings: MONEY_LADDER[state.position - 1] });
    case 'end_session': {
      const lastCorrect = state.lastResult === 'correct' ? state.position : state.position - 1;
      return accept({ ...state, status: 'finished', finishReason: 'ended_by_host', winnings: lastCorrect > 0 ? MONEY_LADDER[lastCorrect - 1] : 0 });
    }
  }
}
