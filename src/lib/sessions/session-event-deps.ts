import 'server-only';

import { createAdminClient } from '../supabase/admin';
import { createAnswerDeps } from './answer-deps';
import type { RunSessionEventDeps } from './run-session-event';

type LoadedSession = {
  hostId: string;
  engineState: unknown;
  version: number;
  currentQuestion: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEngineState(value: unknown): boolean {
  return isRecord(value) && typeof value.status === 'string';
}

export function toLoadedSession(row: unknown): LoadedSession | null {
  if (!isRecord(row) || !isEngineState(row.engine_state)) return null;
  if (typeof row.version !== 'number' || !Number.isInteger(row.version) || row.version < 0) {
    return null;
  }

  const embeddedSession = Array.isArray(row.sessions)
    ? row.sessions.length === 1 ? row.sessions[0] : null
    : row.sessions;
  if (
    !isRecord(embeddedSession) ||
    typeof embeddedSession.host_id !== 'string' ||
    embeddedSession.host_id.length === 0 ||
    !('current_question' in embeddedSession)
  ) {
    return null;
  }

  return {
    hostId: embeddedSession.host_id,
    engineState: row.engine_state,
    version: row.version,
    currentQuestion: embeddedSession.current_question,
  };
}

export function toQuestionRow(row: unknown): {
  id: string;
  text: string;
  options: [string, string, string, string];
} | null {
  if (!isRecord(row)) return null;
  const { id, text, options } = row;
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof text !== 'string' ||
    text.length === 0 ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    options.some((option) => typeof option !== 'string')
  ) {
    return null;
  }

  return {
    id,
    text,
    options: [options[0], options[1], options[2], options[3]],
  };
}

export function createRunSessionEventDeps(
  answerDeps: Pick<ReturnType<typeof createAnswerDeps>, 'loadCorrectIndex'> = createAnswerDeps(),
): RunSessionEventDeps {
  const admin = createAdminClient();

  return {
    async loadSession(sessionId) {
      const { data, error } = await admin
        .from('session_private')
        .select('engine_state, version, sessions!inner(host_id, current_question)')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return toLoadedSession(data);
    },
    async loadQuestionAt(sessionId, position) {
      const { data: sessionQuestion, error: sessionQuestionError } = await admin
        .from('session_questions')
        .select('question_id')
        .eq('session_id', sessionId)
        .eq('position', position)
        .maybeSingle();
      if (sessionQuestionError) throw sessionQuestionError;
      if (
        !isRecord(sessionQuestion) ||
        typeof sessionQuestion.question_id !== 'string' ||
        sessionQuestion.question_id.length === 0
      ) {
        return null;
      }

      const { data, error: questionError } = await admin
        .from('questions')
        .select('id, text, options')
        .eq('id', sessionQuestion.question_id)
        .maybeSingle();
      if (questionError) throw questionError;
      return toQuestionRow(data);
    },
    loadCorrectIndex: answerDeps.loadCorrectIndex,
    async commit(args) {
      const { data, error } = await admin.rpc('commit_transition', args);
      return {
        data: typeof data === 'number' ? data : null,
        error: error ? { code: error.code } : null,
      };
    },
    now: () => Date.now(),
  };
}
