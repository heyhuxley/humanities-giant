import { describe, expect, it } from 'vitest';
import { voteFailureMessage } from './vote-messages';

describe('voteFailureMessage', () => {
  it.each([
    ['closed', 'Voting has closed for this question.'],
    ['not_audience', 'Only audience members can vote.'],
    ['not_found', 'You are not part of this session.'],
    ['invalid_option', 'Pick one of the four answers.'],
    ['unknown', 'Could not record your vote. Try again.'],
  ] as const)('maps %s to its user facing message', (reason, message) => {
    expect(voteFailureMessage(reason)).toBe(message);
  });
});
