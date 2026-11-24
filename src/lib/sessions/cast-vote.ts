import 'server-only';

import { createAdminClient } from '../supabase/admin';

export type VoteOption = 0 | 1 | 2 | 3;

export type CastVoteDependencies = {
  callCastVote(args: {
    p_session_id: string;
    p_user_id: string;
    p_option: number;
    p_now_ms: number;
  }): Promise<{ data: unknown; error: { code?: string } | null }>;
};

export type CastVoteResult =
  | { ok: true; position: number }
  | {
      ok: false;
      reason: 'closed' | 'not_audience' | 'not_found' | 'invalid_option' | 'unknown';
    };

function isVoteOption(value: unknown): value is VoteOption {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 3;
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

function logUnknown(code: string | null): void {
  console.error('[cast_vote] unknown error code:', code);
}

export async function castVoteWithDeps(
  deps: CastVoteDependencies,
  input: { userId: string; sessionId: string; option: number; now: number },
): Promise<CastVoteResult> {
  if (!isVoteOption(input.option)) return { ok: false, reason: 'invalid_option' };

  let response: Awaited<ReturnType<CastVoteDependencies['callCastVote']>>;
  try {
    response = await deps.callCastVote({
      p_session_id: input.sessionId,
      p_user_id: input.userId,
      p_option: input.option,
      p_now_ms: input.now,
    });
  } catch (error) {
    logUnknown(getErrorCode(error));
    return { ok: false, reason: 'unknown' };
  }

  if (response.error) {
    switch (response.error.code) {
      case 'PJ007':
        return { ok: false, reason: 'closed' };
      case 'PJ009':
        return { ok: false, reason: 'not_audience' };
      case 'PJ004':
      case 'PJ001':
        return { ok: false, reason: 'not_found' };
      case 'PJ008':
        return { ok: false, reason: 'invalid_option' };
      default:
        logUnknown(response.error.code ?? null);
        return { ok: false, reason: 'unknown' };
    }
  }

  if (
    typeof response.data !== 'number'
    || !Number.isInteger(response.data)
    || response.data < 1
  ) {
    logUnknown(null);
    return { ok: false, reason: 'unknown' };
  }

  return { ok: true, position: response.data };
}

export async function castVote(
  userId: string,
  sessionId: string,
  option: number,
): Promise<CastVoteResult> {
  const admin = createAdminClient();
  return castVoteWithDeps({
    async callCastVote(args) {
      const { data, error } = await admin.rpc('cast_vote', args);
      return { data, error: error ? { code: error.code } : null };
    },
  }, { userId, sessionId, option, now: Date.now() });
}
