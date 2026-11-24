import 'server-only';

import type { Option } from '../../game';
import { createAdminClient } from '../supabase/admin';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toCorrectIndex(row: unknown): Option | null {
  if (!isRecord(row)) return null;
  const { correct_index: value } = row;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) {
    return null;
  }
  switch (value) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    default:
      return null;
  }
}

export function createAnswerDeps() {
  const admin = createAdminClient();

  return {
    async loadCorrectIndex(sessionId: string, position: number): Promise<Option | null> {
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

      const { data, error } = await admin
        .from('question_answers')
        .select('correct_index')
        .eq('question_id', sessionQuestion.question_id)
        .maybeSingle();
      if (error) throw error;
      return toCorrectIndex(data);
    },
  };
}
