import { getWinningsOnLoss, MONEY_LADDER, QUESTION_DURATION_MS } from './constants';
import { audiencePercentages } from './audience-percentages';
import type { GameError, GameEvent, GameResult, SessionState } from './types';

const reject = (error: GameError): GameResult => ({ ok: false, error });
const accept = (state: SessionState): GameResult => ({ ok: true, state });

export function applyEvent(state: SessionState, event: GameEvent, now: number): GameResult {
  const allowed: Record<GameEvent['type'], SessionState['status'][]> = {
    set_contestant: ['waiting'], start: ['waiting'], select_answer: ['question_active'],
    lock_in: ['question_active'], timer_expired: ['question_active'], reveal: ['locked'],
    next: ['revealed'], walk_away: ['revealed'], end_session: ['waiting', 'question_active', 'locked', 'revealed'],
    use_lifeline: ['question_active'],
  };
  if (!allowed[event.type].includes(state.status)) return reject('wrong_state');
  const actorAllowed = event.type === 'timer_expired'
    ? event.actor.role === 'system'
    : ['set_contestant', 'start', 'reveal', 'next', 'end_session'].includes(event.type)
      ? event.actor.role === 'host'
      : event.actor.role === 'contestant' && event.actor.id === state.contestantId;
  if (!actorAllowed) return reject('not_allowed');
  if ((event.type === 'select_answer' || event.type === 'lock_in') && now >= (state.questionEndsAt ?? Infinity)) return reject('deadline_passed');
  if (event.type === 'use_lifeline' && now >= (state.questionEndsAt ?? Infinity)) return reject('deadline_passed');
  if (event.type === 'timer_expired' && now < (state.questionEndsAt ?? -Infinity)) return reject('too_early');
  if (event.type === 'start' && state.contestantId === null) return reject('no_contestant');
  if (event.type === 'set_contestant' && event.participantId.length === 0) return reject('invalid_input');
  if (event.type === 'lock_in' && state.selectedAnswer === null) return reject('nothing_selected');
  if ((event.type === 'select_answer' || event.type === 'reveal') && ![0, 1, 2, 3].includes(event.type === 'select_answer' ? event.option : event.correctIndex)) return reject('invalid_input');
  if (event.type === 'use_lifeline') {
    const result = state.lifelines[event.lifeline.lifeline === 'fifty_fifty' ? 'fiftyFifty' : event.lifeline.lifeline === 'phone' ? 'phone' : 'audience'];
    if (result.used) return reject('lifeline_used');
    const payload = event.lifeline;
    if (payload.lifeline === 'fifty_fifty' && (!Array.isArray(payload.remove) || payload.remove.length !== 2 || payload.remove[0] === payload.remove[1] || payload.remove.some((option) => ![0, 1, 2, 3].includes(option)))) return reject('invalid_input');
    if (payload.lifeline === 'phone' && (![0, 1, 2, 3].includes(payload.hint) || typeof payload.hintIsCorrect !== 'boolean')) return reject('invalid_input');
    if (payload.lifeline === 'audience' && (!Array.isArray(payload.voteCounts) || payload.voteCounts.length !== 4 || payload.voteCounts.some((count) => !Number.isInteger(count) || count < 0))) return reject('invalid_input');
  }

  switch (event.type) {
    case 'use_lifeline': {
      const lifelines = { ...state.lifelines };
      const payload = event.lifeline;
      if (payload.lifeline === 'fifty_fifty') lifelines.fiftyFifty = { used: true, usedAtPosition: state.position, removed: [payload.remove[0], payload.remove[1]] };
      else if (payload.lifeline === 'phone') lifelines.phone = { used: true, usedAtPosition: state.position, hint: payload.hint, hintIsCorrect: payload.hintIsCorrect };
      else {
        const audience = audiencePercentages(payload.voteCounts);
        lifelines.audience = { used: true, usedAtPosition: state.position, percentages: audience.percentages, notEnoughVotes: audience.notEnoughVotes };
      }
      return accept({ ...state, lifelines });
    }
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
