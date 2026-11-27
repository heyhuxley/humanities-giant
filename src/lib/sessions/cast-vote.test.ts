import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  castVoteWithDeps,
  type CastVoteDependencies,
} from './cast-vote';

vi.mock('server-only', () => ({}));

const input = {
  userId: 'private-user-id-284',
  sessionId: 'private-session-id-639',
  option: 2,
  now: 1_800_000_123_456,
};

function dependencies(response: Awaited<ReturnType<CastVoteDependencies['callCastVote']>>) {
  return { callCastVote: vi.fn().mockResolvedValue(response) };
}

afterEach(() => vi.restoreAllMocks());

describe('castVoteWithDeps', () => {
  it('returns the position on success and sends the supplied values', async () => {
    const deps = dependencies({ data: 7, error: null });

    await expect(castVoteWithDeps(deps, input)).resolves.toEqual({
      ok: true,
      position: 7,
    });
    expect(deps.callCastVote).toHaveBeenCalledWith({
      p_session_id: input.sessionId,
      p_user_id: input.userId,
      p_option: input.option,
      p_now_ms: input.now,
    });
  });

  it.each([
    ['PJ007', 'closed'],
    ['PJ009', 'not_audience'],
    ['PJ004', 'not_found'],
    ['PJ001', 'not_found'],
    ['PJ008', 'invalid_option'],
  ] as const)('maps %s to %s', async (code, reason) => {
    const deps = dependencies({ data: null, error: { code } });

    await expect(castVoteWithDeps(deps, input)).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('maps an unmapped error code to unknown and logs only its code', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = dependencies({ data: null, error: { code: 'XX900' } });

    await expect(castVoteWithDeps(deps, input)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(log).toHaveBeenCalledWith('[cast_vote] unknown error code:', 'XX900');
  });

  it('maps a thrown exception to unknown without logging its message', async () => {
    const error = new Error('private thrown message');
    const deps: CastVoteDependencies = {
      callCastVote: vi.fn().mockRejectedValue(error),
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(castVoteWithDeps(deps, input)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(log).toHaveBeenCalledWith('[cast_vote] unknown error code:', null);
    expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
  });

  it.each([null, '7', 0, 1.5])('maps malformed success data %j to unknown', async (data) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = dependencies({ data, error: null });

    await expect(castVoteWithDeps(deps, input)).resolves.toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(log).toHaveBeenCalledWith('[cast_vote] unknown error code:', null);
  });

  it.each([4, -1, 1.5, '2', Number.NaN, null])(
    'rejects invalid option %j without calling the dependency',
    async (option) => {
      const deps = dependencies({ data: 7, error: null });

      await expect(castVoteWithDeps(deps, { ...input, option: option as number }))
        .resolves.toEqual({ ok: false, reason: 'invalid_option' });
      expect(deps.callCastVote).not.toHaveBeenCalled();
    },
  );

  it('does not log identifiers, option, time, or thrown text on any failure path', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const privateMessage = 'distinctive private dependency detail';
    const mappedCodes = ['PJ007', 'PJ009', 'PJ004', 'PJ001', 'PJ008'];
    const calls = [
      ...mappedCodes.map((code) =>
        castVoteWithDeps(dependencies({ data: null, error: { code } }), input)),
      castVoteWithDeps(dependencies({ data: null, error: { code: 'UNMAPPED' } }), input),
      castVoteWithDeps({
        callCastVote: vi.fn().mockRejectedValue(new Error(privateMessage)),
      }, input),
      castVoteWithDeps(dependencies({ data: null, error: null }), input),
      castVoteWithDeps(dependencies({ data: 1, error: null }), { ...input, option: 4 }),
    ];
    await Promise.all(calls);

    const output = JSON.stringify(log.mock.calls);
    expect(output).not.toContain(input.userId);
    expect(output).not.toContain(input.sessionId);
    expect(output).not.toContain(privateMessage);
    expect(output).not.toContain(String(input.option));
    expect(output).not.toContain(String(input.now));
  });
});
