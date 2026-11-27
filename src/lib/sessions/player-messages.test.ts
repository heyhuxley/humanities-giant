import { describe, expect, it } from 'vitest';
import {
  describeLifelineResult,
  describeKnockOutcome,
  describeSubmitResult,
  describeWalkAwayResult,
} from './player-messages';
import type { RunSessionEventResult } from './run-session-event';

describe('describeLifelineResult', () => {
  it('returns null on success', () => {
    expect(describeLifelineResult({ ok: true, version: 1 })).toBeNull();
  });

  it('maps not found', () => {
    expect(describeLifelineResult({ ok: false, reason: 'not_found' }))
      .toBe('You are not part of this session.');
  });

  it.each([
    ['lifeline_used', 'You have already used that lifeline.'],
    ['not_allowed', 'Only the contestant can use lifelines.'],
    ['deadline_passed', 'Time is up.'],
    ['wrong_state', 'Lifelines can only be used while a question is open.'],
    ['nothing_selected', 'Could not use the lifeline. Try again.'],
  ] as const)('maps rejected %s', (error, message) => {
    const result: RunSessionEventResult = { ok: false, reason: 'rejected', error };
    expect(describeLifelineResult(result)).toBe(message);
  });

  it('maps conflict', () => {
    expect(describeLifelineResult({ ok: false, reason: 'conflict' }))
      .toBe('Another update happened at the same time. Try again.');
  });

  it.each(['unknown', 'participant_not_found', 'unsafe_state'] as const)(
    'maps %s to the generic failure',
    (reason) => {
      const result: RunSessionEventResult = { ok: false, reason };
      expect(describeLifelineResult(result)).toBe('Could not use the lifeline. Try again.');
    },
  );
});

describe('describeWalkAwayResult', () => {
  it('returns null on success', () => {
    expect(describeWalkAwayResult({ ok: true, version: 1 })).toBeNull();
  });

  it('maps not found', () => {
    expect(describeWalkAwayResult({ ok: false, reason: 'not_found' }))
      .toBe('You are not part of this session.');
  });

  it.each([
    ['not_allowed', 'Only the contestant can walk away.'],
    [
      'wrong_state',
      'You can only walk away right after a correct answer is revealed, before the host moves on.',
    ],
    ['deadline_passed', 'Could not walk away. Try again.'],
  ] as const)('maps rejected %s', (error, message) => {
    const result: RunSessionEventResult = { ok: false, reason: 'rejected', error };
    expect(describeWalkAwayResult(result)).toBe(message);
  });

  it('maps conflict', () => {
    expect(describeWalkAwayResult({ ok: false, reason: 'conflict' }))
      .toBe('Another update happened at the same time. Try again.');
  });

  it.each(['unknown', 'participant_not_found', 'unsafe_state'] as const)(
    'maps %s to the generic failure',
    (reason) => {
      const result: RunSessionEventResult = { ok: false, reason };
      expect(describeWalkAwayResult(result)).toBe('Could not walk away. Try again.');
    },
  );
});

describe('describeSubmitResult', () => {
  it('returns null on success', () => {
    expect(describeSubmitResult({ ok: true, version: 1 })).toBeNull();
  });

  it('maps not found', () => {
    expect(describeSubmitResult({ ok: false, reason: 'not_found' }))
      .toBe('You are not part of this session.');
  });

  it.each([
    ['not_allowed', 'Only the contestant can answer.'],
    ['deadline_passed', 'Time is up.'],
    ['wrong_state', 'This question is no longer open.'],
    ['nothing_selected', 'Could not submit your answer. Try again.'],
    ['invalid_input', 'Could not submit your answer. Try again.'],
    ['too_early', 'Could not submit your answer. Try again.'],
    ['lifeline_used', 'Could not submit your answer. Try again.'],
  ] as const)('maps rejected %s', (error, message) => {
    const result: RunSessionEventResult = { ok: false, reason: 'rejected', error };
    expect(describeSubmitResult(result)).toBe(message);
  });

  it('maps conflict', () => {
    expect(describeSubmitResult({ ok: false, reason: 'conflict' }))
      .toBe('Another update happened at the same time. Try again.');
  });

  it.each(['unknown', 'participant_not_found', 'unsafe_state'] as const)(
    'maps %s to the generic failure',
    (reason) => {
      const result: RunSessionEventResult = { ok: false, reason };
      expect(describeSubmitResult(result)).toBe('Something went wrong. Try again.');
    },
  );
});

describe('describeKnockOutcome', () => {
  it.each(['expired', 'noop'] as const)('returns null for %s', (outcome) => {
    expect(describeKnockOutcome(outcome)).toBeNull();
  });

  it('maps not found', () => {
    expect(describeKnockOutcome('not_found')).toBe('Session not found.');
  });

  it('maps unknown', () => {
    expect(describeKnockOutcome('unknown')).toBe('Something went wrong.');
  });
});
