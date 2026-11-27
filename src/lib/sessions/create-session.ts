import 'server-only';

import { createInitialState, toPublicState } from '../../game';
import { createAdminClient } from '../supabase/admin';
import { generateJoinCode } from './join-code';

export type CreateSessionArgs = {
  p_host_id: string;
  p_code: string;
  p_public_state: ReturnType<typeof toPublicState>;
  p_engine_state: ReturnType<typeof createInitialState>;
  p_question_ids: string[];
};

export type CreateSessionDependencies = {
  generateCode(): string;
  callCreateSession(args: CreateSessionArgs): Promise<{
    data: string | null;
    error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null;
  }>;
};

export type CreateSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'ownership' | 'code_exhausted' | 'unknown' };

const OWNERSHIP_ERRORS = new Set([
  'question ids are required',
  'exactly 15 question ids are required',
  'question ids must be distinct',
  'all questions must belong to the host and have answers',
]);

export async function createSessionWithRetry(
  deps: CreateSessionDependencies,
  input: { hostId: string; questionIds: string[] },
): Promise<CreateSessionResult> {
  const engineState = createInitialState();
  const publicState = toPublicState(engineState);
  const baseArgs = {
    p_host_id: input.hostId,
    p_public_state: publicState,
    p_engine_state: engineState,
    p_question_ids: input.questionIds,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let response: Awaited<ReturnType<CreateSessionDependencies['callCreateSession']>>;
    try {
      response = await deps.callCreateSession({ ...baseArgs, p_code: deps.generateCode() });
    } catch {
      console.error('[create_session] callCreateSession failed');
      return { ok: false, reason: 'unknown' };
    }

    if (!response.error) {
      if (response.data) return { ok: true, sessionId: response.data };
      return { ok: false, reason: 'unknown' };
    }

    if (response.error.code === '23505') {
      if (attempt === 4) return { ok: false, reason: 'code_exhausted' };
      continue;
    }

    if (response.error.message && OWNERSHIP_ERRORS.has(response.error.message.trim().toLowerCase())) {
      return { ok: false, reason: 'ownership' };
    }
    if (response.error.code) {
      console.error('[create_session] unmapped database error', response.error.code);
    } else {
      console.error('[create_session] unmapped database error');
    }
    return { ok: false, reason: 'unknown' };
  }

  return { ok: false, reason: 'code_exhausted' };
}

export async function createSession(hostId: string, questionIds: string[]): Promise<CreateSessionResult> {
  const admin = createAdminClient();
  return createSessionWithRetry({
    generateCode: generateJoinCode,
    async callCreateSession(args) {
      const { data, error } = await admin.rpc('create_session', args);
      if (typeof data !== 'string' || data.length === 0) {
        console.error('[create_session] RPC returned no session id');
      }
      return {
        data: typeof data === 'string' ? data : null,
        error: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        } : null,
      };
    },
  }, { hostId, questionIds });
}
