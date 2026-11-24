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
