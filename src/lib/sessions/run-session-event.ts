import 'server-only';

import {
  applyEvent,
  toPublicState,
  type GameEvent,
  type GameError,
  type PublicSessionState,
  type SessionState,
} from '../../game';
import { buildCurrentQuestion, type CurrentQuestion } from './current-question';

export type RunSessionEventDeps = {
  loadSession(sessionId: string): Promise<{
    hostId: string;
    engineState: unknown;
    version: number;
    currentQuestion: unknown;
  } | null>;
  loadQuestionAt(sessionId: string, position: number): Promise<unknown | null>;
  commit(args: {
    p_session_id: string;
    p_expected_version: number;
    p_engine_state: SessionState;
    p_public_state: PublicSessionState;
    p_current_question: CurrentQuestion | null;
    p_set_contestant_id: string | null;
  }): Promise<{ data: number | null; error: { code?: string } | null }>;
  now(): number;
};

export type RunSessionEventResult =
  | { ok: true; version: number }
  | {
      ok: false;
      reason: 'not_found' | 'conflict' | 'participant_not_found' | 'unsafe_state' | 'unknown';
    }
  | { ok: false; reason: 'rejected'; error: GameError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStringStatus(value: unknown): boolean {
  return isRecord(value) && typeof value.status === 'string';
}

function questionRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export async function runSessionEvent(
  deps: RunSessionEventDeps,
  input: { sessionId: string; event: GameEvent },
): Promise<RunSessionEventResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const session = await deps.loadSession(input.sessionId);
      if (session === null) return { ok: false, reason: 'not_found' };

      if (input.event.actor.role === 'host' && session.hostId !== input.event.actor.id) {
        return { ok: false, reason: 'not_found' };
      }

      if (!hasStringStatus(session.engineState)) {
        console.error('run_session_event_invalid_engine_state');
        return { ok: false, reason: 'unknown' };
      }

      const transition = applyEvent(
        session.engineState as SessionState,
        input.event,
        deps.now(),
      );
      if (!transition.ok) {
        return { ok: false, reason: 'rejected', error: transition.error };
      }

      const newState = transition.state;
      const publicState = toPublicState(newState);
      let currentQuestion: CurrentQuestion | null = null;

      if (newState.status === 'question_active') {
        const question = await deps.loadQuestionAt(input.sessionId, newState.position);
        if (question === null) return { ok: false, reason: 'unknown' };
        currentQuestion = buildCurrentQuestion(
          newState.status,
          questionRecord(question),
        );
      } else if (
        newState.status === 'locked' ||
        newState.status === 'revealed' ||
        newState.status === 'finished'
      ) {
        currentQuestion = buildCurrentQuestion(
          newState.status,
          questionRecord(session.currentQuestion),
        );
      }

      const participantId =
        input.event.type === 'set_contestant' ? input.event.participantId : null;
      const result = await deps.commit({
        p_session_id: input.sessionId,
        p_expected_version: session.version,
        p_engine_state: newState,
        p_public_state: publicState,
        p_current_question: currentQuestion,
        p_set_contestant_id: participantId,
      });

      if (result.error !== null) {
        if (result.error.code === 'PJ003') {
          if (attempt === 0) continue;
          return { ok: false, reason: 'conflict' };
        }
        if (result.error.code === 'PJ004') {
          return { ok: false, reason: 'participant_not_found' };
        }
        if (result.error.code === 'PJ005') {
          console.error('PJ005');
          return { ok: false, reason: 'unsafe_state' };
        }
        console.error(result.error.code ?? 'run_session_event_commit_failure');
        return { ok: false, reason: 'unknown' };
      }

      if (typeof result.data !== 'number') {
        console.error('run_session_event_missing_commit_version');
        return { ok: false, reason: 'unknown' };
      }
      return { ok: true, version: result.data };
    } catch {
      console.error('run_session_event_dependency_failure');
      return { ok: false, reason: 'unknown' };
    }
  }

  return { ok: false, reason: 'conflict' };
}
