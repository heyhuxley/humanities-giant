import { describe, expect, it, vi } from 'vitest';
import { createSessionWithRetry, type CreateSessionArgs, type CreateSessionDependencies } from './create-session';

vi.mock('server-only', () => ({}));

const questionIds = Array.from({ length: 15 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
const input = { hostId: 'host-id', questionIds };

function dependencies(
  callCreateSession: CreateSessionDependencies['callCreateSession'],
  codes: string[] = ['AB2345'],
): CreateSessionDependencies & { generateCode: ReturnType<typeof vi.fn> } {
  return {
    generateCode: vi.fn(() => codes.shift() ?? 'ZX9876'),
    callCreateSession,
  };
}

describe('createSessionWithRetry', () => {
  it('succeeds on the first attempt and sends initial public and engine states', async () => {
    let args: CreateSessionArgs | undefined;
    const deps = dependencies(async (received) => {
      args = received;
      return { data: 'session-id', error: null };
    });

    await expect(createSessionWithRetry(deps, input)).resolves.toEqual({ ok: true, sessionId: 'session-id' });
    expect(deps.generateCode).toHaveBeenCalledTimes(1);
    expect(args?.p_engine_state.status).toBe('waiting');
    expect(args?.p_public_state.lifelines.phone.hintIsCorrect).toBeNull();
    expect(args?.p_engine_state).not.toBe(args?.p_public_state);
    expect(args?.p_host_id).toBe(input.hostId);
    expect(args?.p_question_ids).toBe(input.questionIds);
  });

  it('retries one code collision with a new code, then succeeds', async () => {
    const codes = ['AB2345', 'CD6789'];
    const deps = dependencies(vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate code' } })
      .mockResolvedValueOnce({ data: 'session-id', error: null }), codes);

    await expect(createSessionWithRetry(deps, input)).resolves.toEqual({ ok: true, sessionId: 'session-id' });
    expect(deps.generateCode).toHaveBeenCalledTimes(2);
    const usedCodes = (deps.callCreateSession as ReturnType<typeof vi.fn>).mock.calls.map(([args]) => args.p_code);
    expect(usedCodes).toEqual(['AB2345', 'CD6789']);
  });

  it('stops after five code collisions', async () => {
    const deps = dependencies(vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }));

    await expect(createSessionWithRetry(deps, input)).resolves.toEqual({ ok: false, reason: 'code_exhausted' });
    expect(deps.generateCode).toHaveBeenCalledTimes(5);
    expect(deps.callCreateSession).toHaveBeenCalledTimes(5);
  });

  it('stops after one non collision error without exposing its message', async () => {
    const deps = dependencies(vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'private database details' } }));

    await expect(createSessionWithRetry(deps, input)).resolves.toEqual({ ok: false, reason: 'unknown' });
    expect(deps.generateCode).toHaveBeenCalledTimes(1);
    expect(deps.callCreateSession).toHaveBeenCalledTimes(1);
  });

  it('does not log database details, ids, or the generated code for an unmapped error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = dependencies(vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'private database details',
        details: 'private database details',
        hint: 'private database details',
      },
    }), ['Q7R8S9']);

    try {
      await expect(createSessionWithRetry(deps, input)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
      const output = JSON.stringify(log.mock.calls);
      for (const value of ['private database details', input.hostId, ...questionIds, 'Q7R8S9']) {
        expect(output).not.toContain(value);
      }
    } finally {
      log.mockRestore();
    }
  });

  it('does not log a thrown dependency error, ids, or the generated code', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = dependencies(
      vi.fn().mockRejectedValue(new Error('private database details')),
      ['T1U2V3'],
    );

    try {
      await expect(createSessionWithRetry(deps, input)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
      const output = JSON.stringify(log.mock.calls);
      for (const value of ['private database details', input.hostId, ...questionIds, 'T1U2V3']) {
        expect(output).not.toContain(value);
      }
    } finally {
      log.mockRestore();
    }
  });

  it('does not log generated codes or private details after five code collisions', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const codes = ['A1B2C3', 'D4E5F6', 'G7H8J9', 'K1L2M3', 'N4P5Q6'];
    const deps = dependencies(
      vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'private database details',
          details: 'private database details',
          hint: 'private database details',
        },
      }),
      codes,
    );

    try {
      await expect(createSessionWithRetry(deps, input)).resolves.toEqual({
        ok: false,
        reason: 'code_exhausted',
      });
      const output = JSON.stringify(log.mock.calls);
      for (const value of [
        'private database details',
        input.hostId,
        ...questionIds,
        'A1B2C3',
        'D4E5F6',
        'G7H8J9',
        'K1L2M3',
        'N4P5Q6',
      ]) {
        expect(output).not.toContain(value);
      }
    } finally {
      log.mockRestore();
    }
  });

  it.each([
    'question ids are required',
    'exactly 15 question ids are required',
    'question ids must be distinct',
    'all questions must belong to the host and have answers',
  ])('maps the function validation error to ownership: %s', async (message) => {
    const deps = dependencies(vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message } }));

    await expect(createSessionWithRetry(deps, input)).resolves.toEqual({ ok: false, reason: 'ownership' });
    expect(deps.callCreateSession).toHaveBeenCalledTimes(1);
  });

  it('maps a rejected dependency call to an unknown error', async () => {
    const deps = dependencies(vi.fn().mockRejectedValue(new Error('private database details')));

    await expect(createSessionWithRetry(deps, input)).resolves.toEqual({ ok: false, reason: 'unknown' });
    expect(deps.callCreateSession).toHaveBeenCalledTimes(1);
  });
});
