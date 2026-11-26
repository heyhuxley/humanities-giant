import { describeEngineError } from './event-messages';
import type { RunSessionEventResult } from './run-session-event';

export function describeRunResult(result: RunSessionEventResult): string | null {
  if (result.ok) return null;

  if (result.reason === 'rejected') return describeEngineError(result.error);
  if (result.reason === 'not_found') return 'Session not found.';
  if (result.reason === 'conflict') {
    return 'Another update happened at the same time. Try again.';
  }
  if (result.reason === 'participant_not_found') {
    return 'That player is no longer in this session.';
  }
  return 'Something went wrong. Try again.';
}

export function describeRevealResult(result: RunSessionEventResult): string | null {
  if (!result.ok && result.reason === 'rejected' && result.error === 'wrong_state') {
    return "The answer isn't locked in yet, or has already been revealed.";
  }
  return describeRunResult(result);
}

export function describeNextResult(result: RunSessionEventResult): string | null {
  if (!result.ok && result.reason === 'rejected' && result.error === 'wrong_state') {
    return 'Reveal the answer first, or the session has already finished.';
  }
  return describeRunResult(result);
}
