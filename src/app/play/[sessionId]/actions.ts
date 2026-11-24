'use server';

import { revalidatePath } from 'next/cache';
import { castVote } from '../../../lib/sessions/cast-vote';
import { createRunSessionEventDeps } from '../../../lib/sessions/session-event-deps';
import { describeSubmitResult } from '../../../lib/sessions/player-messages';
import { parseSubmitAnswerForm, parseVoteForm } from '../../../lib/sessions/player-forms';
import { submitAnswerFlow, voteFlow } from '../../../lib/sessions/player-flows';
import { runSessionEvent } from '../../../lib/sessions/run-session-event';
import { voteFailureMessage } from '../../../lib/sessions/vote-messages';
import { getVerifiedUserId } from '../../../lib/sessions/verified-user';
import { createClient } from '../../../lib/supabase/server';

type PlayerActionState = { error: string | null };

function unknownSubmitMessage(): string {
  return describeSubmitResult({ ok: false, reason: 'unknown' }) ?? 'Something went wrong.';
}

export async function submitAnswerAction(
  _previous: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const userId = await getVerifiedUserId();
  if (userId === null) return { error: 'Please rejoin the session.' };

  const parsed = parseSubmitAnswerForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const supabase = await createClient();
    const result = await submitAnswerFlow({
      async findParticipantId(sessionId, callerId) {
        const { data, error } = await supabase
          .from('participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', callerId)
          .maybeSingle();
        if (error) throw error;
        return typeof data?.id === 'string' ? data.id : null;
      },
      run: (event) => runSessionEvent(createRunSessionEventDeps(), {
        sessionId: parsed.sessionId,
        event,
      }),
    }, { userId, sessionId: parsed.sessionId, option: parsed.option });

    const error = describeSubmitResult(result);
    if (error !== null) return { error };

    revalidatePath(`/play/${parsed.sessionId}`);
    return { error: null };
  } catch {
    return { error: unknownSubmitMessage() };
  }
}

export async function castVoteAction(
  _previous: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const userId = await getVerifiedUserId();
  if (userId === null) return { error: 'Please rejoin the session.' };

  const parsed = parseVoteForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const result = await voteFlow({ castVote }, {
      userId,
      sessionId: parsed.sessionId,
      option: parsed.option,
    });
    if (!result.ok) return { error: voteFailureMessage(result.reason) };

    revalidatePath(`/play/${parsed.sessionId}`);
    return { error: null };
  } catch {
    return { error: voteFailureMessage('unknown') };
  }
}
