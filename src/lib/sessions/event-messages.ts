import type { GameError } from '../../game';

const ENGINE_ERROR_MESSAGES: Record<GameError, string> = {
  wrong_state: 'This action is not available right now.',
  not_allowed: 'You are not allowed to do that.',
  deadline_passed: 'Time has run out for this question.',
  too_early: 'The timer has not run out yet.',
  lifeline_used: 'You have already used this lifeline.',
  invalid_input: 'That choice is not valid.',
  no_contestant: 'Choose a contestant before starting.',
  nothing_selected: 'Choose an answer before locking it in.',
};

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function describeEngineError(code: string): string {
  return Object.prototype.hasOwnProperty.call(ENGINE_ERROR_MESSAGES, code)
    ? ENGINE_ERROR_MESSAGES[code as GameError]
    : GENERIC_ERROR_MESSAGE;
}
