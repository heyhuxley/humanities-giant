export type VoteFailureReason =
  | 'closed'
  | 'not_audience'
  | 'not_found'
  | 'invalid_option'
  | 'unknown';

export function voteFailureMessage(reason: VoteFailureReason): string {
  switch (reason) {
    case 'closed':
      return 'Voting has closed for this question.';
    case 'not_audience':
      return 'Only audience members can vote.';
    case 'not_found':
      return 'You are not part of this session.';
    case 'invalid_option':
      return 'Pick one of the four answers.';
    case 'unknown':
      return 'Could not record your vote. Try again.';
  }
}
