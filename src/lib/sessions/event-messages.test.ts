import { describe, expect, it } from 'vitest';
import { describeEngineError } from './event-messages';

describe('describeEngineError', () => {
  it.each([
    ['wrong_state', 'This action is not available right now.'],
    ['not_allowed', 'You are not allowed to do that.'],
    ['deadline_passed', 'Time has run out for this question.'],
    ['too_early', 'The timer has not run out yet.'],
    ['lifeline_used', 'You have already used this lifeline.'],
    ['invalid_input', 'That choice is not valid.'],
    ['no_contestant', 'Choose a contestant before starting.'],
    ['nothing_selected', 'Choose an answer before locking it in.'],
  ])('describes %s', (code, message) => {
    expect(describeEngineError(code)).toBe(message);
  });

  it('uses a generic message for unknown codes', () => {
    expect(describeEngineError('unknown')).toBe('Something went wrong. Please try again.');
  });
});
