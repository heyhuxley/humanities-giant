import 'server-only';

import type { Option } from '../../game';
import type { CastVoteResult } from './cast-vote';
import type { RunnableEvent, RunSessionEventResult } from './run-session-event';

type OptionIndex = 0 | 1 | 2 | 3;

export type SubmitAnswerDependencies = {
  findParticipantId(sessionId: string, userId: string): Promise<string | null>;
  run(event: RunnableEvent): Promise<RunSessionEventResult>;
};

export type VoteDependencies = {
  castVote(userId: string, sessionId: string, option: OptionIndex): Promise<CastVoteResult>;
};

export type KnockDependencies = {
  canReadSession(sessionId: string): Promise<boolean>;
  run(event: RunnableEvent): Promise<RunSessionEventResult>;
};

export type KnockOutcome = 'expired' | 'noop' | 'not_found' | 'unknown';

function logFailure(label: string): void {
  console.error(label);
}

export async function submitAnswerFlow(
  deps: SubmitAnswerDependencies,
  input: { userId: string; sessionId: string; option: Option },
): Promise<RunSessionEventResult> {
  try {
    const participantId = await deps.findParticipantId(input.sessionId, input.userId);
    if (participantId === null) return { ok: false, reason: 'not_found' };

    const actor = { id: participantId, role: 'contestant' } as const;
    const selected = await deps.run({
      type: 'select_answer',
      actor,
      option: input.option,
    });
    if (!selected.ok) return selected;

    return await deps.run({ type: 'lock_in', actor });
  } catch {
    logFailure('submit_answer_dependency_failure');
    return { ok: false, reason: 'unknown' };
  }
}

export async function voteFlow(
  deps: VoteDependencies,
  input: { userId: string; sessionId: string; option: OptionIndex },
): Promise<CastVoteResult> {
  try {
    return await deps.castVote(input.userId, input.sessionId, input.option);
  } catch {
    logFailure('vote_dependency_failure');
    return { ok: false, reason: 'unknown' };
  }
}

export async function knockFlow(
  deps: KnockDependencies,
  input: { sessionId: string },
): Promise<KnockOutcome> {
  try {
    if (!(await deps.canReadSession(input.sessionId))) return 'not_found';

    const result = await deps.run({
      type: 'timer_expired',
      actor: { id: 'system', role: 'system' },
    });
    if (result.ok) return 'expired';
    if (result.reason === 'not_found') return 'not_found';
    if (result.reason === 'rejected') {
      return result.error === 'too_early' || result.error === 'wrong_state'
        ? 'noop'
        : 'unknown';
    }
    return 'unknown';
  } catch {
    logFailure('knock_dependency_failure');
    return 'unknown';
  }
}
