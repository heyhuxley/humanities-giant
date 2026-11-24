import { describe, expect, it } from 'vitest';
import { describeRunResult } from './run-result-messages';

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
