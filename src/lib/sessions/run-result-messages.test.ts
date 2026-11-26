import { describe, expect, it } from 'vitest';
import {
  describeNextResult,
  describeRevealResult,
  describeRunResult,
} from './run-result-messages';

describe('describeRunResult', () => {
  it('returns null for success', () => {
    expect(describeRunResult({ ok: true, version: 4 })).toBeNull();
  });

  it('describes a missing session', () => {
    expect(describeRunResult({ ok: false, reason: 'not_found' })).toBe('Session not found.');
  });

  it('describes a conflict', () => {
    expect(describeRunResult({ ok: false, reason: 'conflict' })).toBe(
      'Another update happened at the same time. Try again.',
    );
  });

  it('describes a missing participant', () => {
    expect(describeRunResult({ ok: false, reason: 'participant_not_found' })).toBe(
      'That player is no longer in this session.',
    );
  });

  it.each(['unsafe_state', 'unknown'] as const)('uses the generic message for %s', (reason) => {
    expect(describeRunResult({ ok: false, reason })).toBe('Something went wrong. Try again.');
  });

  it('maps engine rejections to their user facing message', () => {
    expect(describeRunResult({ ok: false, reason: 'rejected', error: 'no_contestant' })).toBe(
      'Choose a contestant before starting.',
    );
  });
});

const otherResultMessages = [
  [{ ok: false, reason: 'not_found' }, 'Session not found.'],
  [{ ok: false, reason: 'conflict' }, 'Another update happened at the same time. Try again.'],
  [{ ok: false, reason: 'participant_not_found' }, 'That player is no longer in this session.'],
  [{ ok: false, reason: 'unsafe_state' }, 'Something went wrong. Try again.'],
  [{ ok: false, reason: 'unknown' }, 'Something went wrong. Try again.'],
] as const;

describe.each([
  ['describeRevealResult', describeRevealResult, "The answer isn't locked in yet, or has already been revealed."],
  ['describeNextResult', describeNextResult, 'Reveal the answer first, or the session has already finished.'],
])('%s', (_name, describeResult, wrongStateMessage) => {
  it('returns null for success', () => {
    expect(describeResult({ ok: true, version: 4 })).toBeNull();
  });

  it('uses the action specific message for wrong_state', () => {
    expect(describeResult({ ok: false, reason: 'rejected', error: 'wrong_state' })).toBe(
      wrongStateMessage,
    );
  });

  it.each(otherResultMessages)('preserves the message for %s', (result, message) => {
    expect(describeResult(result)).toBe(message);
  });

  it('uses the existing engine message for other rejections', () => {
    expect(describeResult({ ok: false, reason: 'rejected', error: 'no_contestant' })).toBe(
      'Choose a contestant before starting.',
    );
  });
});
