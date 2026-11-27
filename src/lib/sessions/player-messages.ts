import type { RunSessionEventResult } from './run-session-event';
import type { KnockOutcome } from './player-flows';

export function describeLifelineResult(result: RunSessionEventResult): string | null {
  if (result.ok) return null;
  if (result.reason === 'not_found') return 'You are not part of this session.';
  if (result.reason === 'rejected') {
    switch (result.error) {
      case 'lifeline_used':
        return 'You have already used that lifeline.';
      case 'not_allowed':
        return 'Only the contestant can use lifelines.';
      case 'deadline_passed':
        return 'Time is up.';
      case 'wrong_state':
        return 'Lifelines can only be used while a question is open.';
      default:
        return 'Could not use the lifeline. Try again.';
    }
  }
  if (result.reason === 'conflict') {
    return 'Another update happened at the same time. Try again.';
  }
  return 'Could not use the lifeline. Try again.';
}

export function describeWalkAwayResult(result: RunSessionEventResult): string | null {
  if (result.ok) return null;
  if (result.reason === 'not_found') return 'You are not part of this session.';
  if (result.reason === 'rejected') {
    if (result.error === 'not_allowed') return 'Only the contestant can walk away.';
    if (result.error === 'wrong_state') {
      return 'You can only walk away right after a correct answer is revealed, before the host moves on.';
    }
  }
  if (result.reason === 'conflict') {
    return 'Another update happened at the same time. Try again.';
  }
  return 'Could not walk away. Try again.';
}

export function describeSubmitResult(result: RunSessionEventResult): string | null {
  if (result.ok) return null;
  if (result.reason === 'not_found') return 'You are not part of this session.';
  if (result.reason === 'rejected') {
    switch (result.error) {
      case 'not_allowed':
        return 'Only the contestant can answer.';
      case 'deadline_passed':
        return 'Time is up.';
      case 'wrong_state':
        return 'This question is no longer open.';
      default:
        return 'Could not submit your answer. Try again.';
    }
  }
  if (result.reason === 'conflict') {
    return 'Another update happened at the same time. Try again.';
  }
  return 'Something went wrong. Try again.';
}

export function describeKnockOutcome(outcome: KnockOutcome): string | null {
  switch (outcome) {
    case 'expired':
    case 'noop':
      return null;
    case 'not_found':
      return 'Session not found.';
    case 'unknown':
      return 'Something went wrong.';
  }
}
