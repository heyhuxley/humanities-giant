export type JoinFailureReason = 'unavailable' | 'full' | 'unknown';

export const SIGNED_IN_JOIN_MESSAGE =
  'You are signed in with a non-player account. Sign out to join as a player.';

export function joinFailureMessage(reason: JoinFailureReason): string {
  switch (reason) {
    case 'unavailable':
      return 'Session not found or closed.';
    case 'full':
      return 'This session is full.';
    case 'unknown':
      return 'Could not join. Try again.';
  }
}
