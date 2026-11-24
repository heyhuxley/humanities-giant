import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  knockFlow,
  submitAnswerFlow,
  voteFlow,
  type KnockDependencies,
  type SubmitAnswerDependencies,
} from './player-flows';
import type { RunSessionEventResult } from './run-session-event';
import type { CastVoteResult } from './cast-vote';

vi.mock('server-only', () => ({}));

const input = {
  userId: 'private-user-id-293',
  sessionId: 'private-session-id-847',
  option: 2 as const,
};
const participantId = 'private-participant-id-615';

afterEach(() => vi.restoreAllMocks());

function submitDeps(
  run: SubmitAnswerDependencies['run'] = vi.fn(async () => ({ ok: true as const, version: 3 })),
  findParticipantId: SubmitAnswerDependencies['findParticipantId'] = vi.fn(async () => participantId),
): SubmitAnswerDependencies {
  return { findParticipantId, run };
}

describe('submitAnswerFlow', () => {
  it('runs select then lock with the found participant as actor', async () => {
    const run = vi.fn<SubmitAnswerDependencies['run']>()
      .mockResolvedValueOnce({ ok: true, version: 3 })
      .mockResolvedValueOnce({ ok: true, version: 4 });

    await expect(submitAnswerFlow(submitDeps(run), input)).resolves.toEqual({
      ok: true,
      version: 4,
    });
    expect(run.mock.calls.map(([event]) => event)).toEqual([
      {
        type: 'select_answer',
        actor: { id: participantId, role: 'contestant' },
        option: 2,
      },
      {
        type: 'lock_in',
        actor: { id: participantId, role: 'contestant' },
      },
    ]);
    expect(JSON.stringify(run.mock.calls)).not.toContain(input.userId);
  });

  it('does not run when participant lookup returns null', async () => {
    const run = vi.fn<SubmitAnswerDependencies['run']>();
    await expect(submitAnswerFlow(
      submitDeps(run, vi.fn(async () => null)),
      input,
    )).resolves.toEqual({ ok: false, reason: 'not_found' });
    expect(run).not.toHaveBeenCalled();
  });

  it.each(['not_allowed', 'wrong_state', 'deadline_passed'] as const)(
    'returns select rejection %s without locking',
    async (error) => {
      const result: RunSessionEventResult = { ok: false, reason: 'rejected', error };
      const run = vi.fn<SubmitAnswerDependencies['run']>().mockResolvedValue(result);
      await expect(submitAnswerFlow(submitDeps(run), input)).resolves.toBe(result);
      expect(run).toHaveBeenCalledTimes(1);
    },
  );

  it('returns a lock rejection after a successful selection', async () => {
    const rejection: RunSessionEventResult = {
      ok: false,
      reason: 'rejected',
      error: 'deadline_passed',
    };
    const run = vi.fn<SubmitAnswerDependencies['run']>()
      .mockResolvedValueOnce({ ok: true, version: 3 })
      .mockResolvedValueOnce(rejection);
    await expect(submitAnswerFlow(submitDeps(run), input)).resolves.toBe(rejection);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('returns unknown for a lock result that is unknown', async () => {
    const run = vi.fn<SubmitAnswerDependencies['run']>()
      .mockResolvedValueOnce({ ok: true, version: 3 })
      .mockResolvedValueOnce({ ok: false, reason: 'unknown' });
    await expect(submitAnswerFlow(submitDeps(run), input)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it.each(['findParticipantId', 'run'] as const)(
    'catches a thrown %s dependency and logs no identifiers',
    async (dependency) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const deps = dependency === 'findParticipantId'
        ? submitDeps(undefined, vi.fn(async () => { throw new Error('private'); }))
        : submitDeps(vi.fn(async () => { throw new Error('private'); }));

      await expect(submitAnswerFlow(deps, input)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain(input.userId);
      expect(JSON.stringify(log.mock.calls)).not.toContain(input.sessionId);
      expect(JSON.stringify(log.mock.calls)).not.toContain(participantId);
    },
  );
});

describe('voteFlow', () => {
  it('returns successful cast vote result', async () => {
    const result: CastVoteResult = { ok: true, position: 4 };
    const castVote = vi.fn(async () => result);
    await expect(voteFlow({ castVote }, input)).resolves.toBe(result);
    expect(castVote).toHaveBeenCalledOnce();
    expect(castVote).toHaveBeenCalledWith(input.userId, input.sessionId, input.option);
  });

  it.each([
    { ok: false, reason: 'closed' },
    { ok: false, reason: 'not_audience' },
    { ok: false, reason: 'not_found' },
    { ok: false, reason: 'invalid_option' },
    { ok: false, reason: 'unknown' },
  ] satisfies CastVoteResult[])('passes cast vote failure $reason through unchanged', async (result) => {
    const castVote = vi.fn(async () => result);
    await expect(voteFlow({ castVote }, input)).resolves.toBe(result);
  });

  it('returns unknown when cast vote throws and logs no identifiers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const castVote = vi.fn(async () => { throw new Error('private vote error'); });
    await expect(voteFlow({ castVote }, input)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.userId);
    expect(JSON.stringify(log.mock.calls)).not.toContain(input.sessionId);
  });
});

function knockDeps(
  result: RunSessionEventResult = { ok: true, version: 4 },
  canReadSession: KnockDependencies['canReadSession'] = vi.fn(async () => true),
  run: KnockDependencies['run'] = vi.fn(async () => result),
): KnockDependencies {
  return { canReadSession, run };
}

describe('knockFlow', () => {
  it('does not run when the caller cannot read the session', async () => {
    const run = vi.fn<KnockDependencies['run']>();
    await expect(knockFlow(
      knockDeps(undefined, vi.fn(async () => false), run),
      { sessionId: input.sessionId },
    )).resolves.toBe('not_found');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs timer_expired with the exact system actor and maps success', async () => {
    const run = vi.fn<KnockDependencies['run']>().mockResolvedValue({
      ok: true,
      version: 5,
    });
    await expect(knockFlow(knockDeps(undefined, undefined, run), {
      sessionId: input.sessionId,
    })).resolves.toBe('expired');
    expect(run).toHaveBeenCalledWith({
      type: 'timer_expired',
      actor: { id: 'system', role: 'system' },
    });
  });

  it.each(['too_early', 'wrong_state'] as const)('maps %s to noop', async (error) => {
    const result: RunSessionEventResult = { ok: false, reason: 'rejected', error };
    await expect(knockFlow(knockDeps(result), { sessionId: input.sessionId })).resolves.toBe('noop');
  });

  it.each(['not_allowed', 'deadline_passed'] as const)('maps %s to unknown', async (error) => {
    const result: RunSessionEventResult = { ok: false, reason: 'rejected', error };
    await expect(knockFlow(knockDeps(result), { sessionId: input.sessionId })).resolves.toBe('unknown');
  });

  it.each([
    { ok: false, reason: 'not_found' },
    { ok: false, reason: 'conflict' },
    { ok: false, reason: 'unknown' },
    { ok: false, reason: 'participant_not_found' },
    { ok: false, reason: 'unsafe_state' },
  ] satisfies RunSessionEventResult[])('maps $reason outcome', async (result) => {
    await expect(knockFlow(knockDeps(result), { sessionId: input.sessionId }))
      .resolves.toBe(result.reason === 'not_found' ? 'not_found' : 'unknown');
  });

  it.each(['canReadSession', 'run'] as const)(
    'catches a thrown %s dependency and logs no identifiers',
    async (dependency) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const deps = dependency === 'canReadSession'
        ? knockDeps(undefined, vi.fn(async () => { throw new Error('private'); }))
        : knockDeps(undefined, undefined, vi.fn(async () => { throw new Error('private'); }));

      await expect(knockFlow(deps, { sessionId: input.sessionId })).resolves.toBe('unknown');
      expect(JSON.stringify(log.mock.calls)).not.toContain(input.sessionId);
      expect(JSON.stringify(log.mock.calls)).not.toContain(input.userId);
    },
  );
});
