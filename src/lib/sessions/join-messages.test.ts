import { describe, expect, it } from 'vitest';
import { SIGNED_IN_JOIN_MESSAGE, joinFailureMessage } from './join-messages';

describe('joinFailureMessage', () => {
  it.each([
    ['unavailable', 'Session not found or closed.'],
    ['full', 'This session is full.'],
    ['unknown', 'Could not join. Try again.'],
  ] as const)('maps %s to its user facing message', (reason, message) => {
    expect(joinFailureMessage(reason)).toBe(message);
  });

  it('exports the signed in account message', () => {
    expect(SIGNED_IN_JOIN_MESSAGE).toBe(
      'You are signed in with a non-player account. Sign out to join as a player.',
    );
  });
});
