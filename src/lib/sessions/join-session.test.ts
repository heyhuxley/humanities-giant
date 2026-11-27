import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinSessionWithDeps, MAX_AUDIENCE, type JoinSessionDependencies } from './join-session';

vi.mock('server-only', () => ({}));

const input = { userId: 'user-private-id', code: 'AB2345', displayName: 'Private Name' };
const successData = { session_id: 'session-id', participant_id: 'participant-id' };

function dependencies(
  response: Awaited<ReturnType<JoinSessionDependencies['callJoinSession']>>,
): JoinSessionDependencies & { callJoinSession: ReturnType<typeof vi.fn> } {
  return { callJoinSession: vi.fn().mockResolvedValue(response) };
}

afterEach(() => vi.restoreAllMocks());

describe('joinSessionWithDeps', () => {
  it('returns session and participant ids on success', async () => {
    const deps = dependencies({ data: successData, error: null });

    await expect(joinSessionWithDeps(deps, input)).resolves.toEqual({
      ok: true,
      sessionId: 'session-id',
      participantId: 'participant-id',
    });
  });

  it.each([
    ['PJ001', 'unavailable'],
    ['PJ002', 'full'],
  ] as const)('maps %s to %s', async (code, reason) => {
    const deps = dependencies({ data: null, error: { code } });
    await expect(joinSessionWithDeps(deps, input)).resolves.toEqual({ ok: false, reason });
  });

  it('maps any other error code to unknown', async () => {
    const deps = dependencies({ data: null, error: { code: '42501' } });
    await expect(joinSessionWithDeps(deps, input)).resolves.toEqual({ ok: false, reason: 'unknown' });
  });

  it('catches a thrown exception and logs only its code', async () => {
    const error = Object.assign(new Error('private message'), { code: 'NETWORK' });
    const deps: JoinSessionDependencies = { callJoinSession: vi.fn().mockRejectedValue(error) };
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(joinSessionWithDeps(deps, input)).resolves.toEqual({ ok: false, reason: 'unknown' });
    expect(log).toHaveBeenCalledWith('[join_session] unknown error code:', 'NETWORK');
    expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
  });

  it.each([
    undefined,
    null,
    {},
    { participant_id: 'participant-id' },
    { session_id: 'session-id' },
    { session_id: 123, participant_id: 'participant-id' },
    { session_id: 'session-id', participant_id: null },
    ['session-id', 'participant-id'],
  ])('returns unknown for malformed data: %j', async (data) => {
    const deps = dependencies({ data, error: null });
    await expect(joinSessionWithDeps(deps, input)).resolves.toEqual({ ok: false, reason: 'unknown' });
  });

  it('sends the expected arguments and the audience limit', async () => {
    const deps = dependencies({ data: successData, error: null });
    await joinSessionWithDeps(deps, input);

    expect(deps.callJoinSession).toHaveBeenCalledWith({
      p_user_id: input.userId,
      p_code: input.code,
      p_display_name: input.displayName,
      p_max_audience: MAX_AUDIENCE,
    });
    expect(MAX_AUDIENCE).toBe(100);
  });

  it('never logs the user id or display name', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = dependencies({ data: null, error: { code: 'UNEXPECTED' } });

    await joinSessionWithDeps(deps, input);
    const calls = JSON.stringify(log.mock.calls);
    expect(calls).not.toContain(input.userId);
    expect(calls).not.toContain(input.displayName);
    expect(calls).toContain('UNEXPECTED');
  });
});
