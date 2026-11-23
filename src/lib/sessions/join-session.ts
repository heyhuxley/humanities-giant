import 'server-only';

import { createAdminClient } from '../supabase/admin';

export const MAX_AUDIENCE = 100;

export type JoinSessionArgs = {
  p_user_id: string;
  p_code: string;
  p_display_name: string;
  p_max_audience: number;
};

export type JoinSessionDependencies = {
  callJoinSession(args: JoinSessionArgs): Promise<{
    data: unknown;
    error: { code?: string } | null;
  }>;
};

export type JoinSessionResult =
  | { ok: true; sessionId: string; participantId: string }
  | { ok: false; reason: 'unavailable' | 'full' | 'unknown' };

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

function logUnknown(code: string | null): void {
  console.error('[join_session] unknown error code:', code);
}

function isJoinResult(value: unknown): value is { session_id: string; participant_id: string } {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && 'session_id' in value
    && typeof value.session_id === 'string'
    && 'participant_id' in value
    && typeof value.participant_id === 'string';
}

export async function joinSessionWithDeps(
  deps: JoinSessionDependencies,
  input: { userId: string; code: string; displayName: string },
): Promise<JoinSessionResult> {
  const args: JoinSessionArgs = {
    p_user_id: input.userId,
    p_code: input.code,
    p_display_name: input.displayName,
    p_max_audience: MAX_AUDIENCE,
  };

  let response: Awaited<ReturnType<JoinSessionDependencies['callJoinSession']>>;
  try {
    response = await deps.callJoinSession(args);
  } catch (error) {
    logUnknown(getErrorCode(error));
    return { ok: false, reason: 'unknown' };
  }

  if (response.error) {
    if (response.error.code === 'PJ001') return { ok: false, reason: 'unavailable' };
    if (response.error.code === 'PJ002') return { ok: false, reason: 'full' };
    logUnknown(response.error.code ?? null);
    return { ok: false, reason: 'unknown' };
  }

  if (!isJoinResult(response.data)) {
    logUnknown(null);
    return { ok: false, reason: 'unknown' };
  }

  return {
    ok: true,
    sessionId: response.data.session_id,
    participantId: response.data.participant_id,
  };
}

export async function joinSession(userId: string, code: string, displayName: string): Promise<JoinSessionResult> {
  const admin = createAdminClient();
  return joinSessionWithDeps({
    async callJoinSession(args) {
      const { data, error } = await admin.rpc('join_session', args);
      return { data, error: error ? { code: error.code } : null };
    },
  }, { userId, code, displayName });
}
