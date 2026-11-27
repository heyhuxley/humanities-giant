'use server';

import { revalidatePath } from 'next/cache';
import { knockFlow } from '../../lib/sessions/player-flows';
import { describeKnockOutcome } from '../../lib/sessions/player-messages';
import { parseKnockForm } from '../../lib/sessions/player-forms';
import { createRunSessionEventDeps } from '../../lib/sessions/session-event-deps';
import { runSessionEvent } from '../../lib/sessions/run-session-event';
import { getVerifiedUserId } from '../../lib/sessions/verified-user';
import { createClient } from '../../lib/supabase/server';

type KnockActionState = { error: string | null };

export async function knockAction(
  _previous: KnockActionState,
  formData: FormData,
): Promise<KnockActionState> {
  const userId = await getVerifiedUserId();
  if (userId === null) return { error: null };

  const parsed = parseKnockForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const supabase = await createClient();
    const outcome = await knockFlow({
      async canReadSession(sessionId) {
        const { data, error } = await supabase
          .from('sessions')
          .select('id')
          .eq('id', sessionId)
          .maybeSingle();
        if (error) throw error;
        return data !== null;
      },
      run: (event) => runSessionEvent(createRunSessionEventDeps(), {
        sessionId: parsed.sessionId,
        event,
      }),
    }, { sessionId: parsed.sessionId });

    if (outcome === 'expired') {
      revalidatePath(`/play/${parsed.sessionId}`);
      revalidatePath(`/host/sessions/${parsed.sessionId}`);
    }

    return { error: describeKnockOutcome(outcome) };
  } catch {
    return { error: describeKnockOutcome('unknown') };
  }
}
