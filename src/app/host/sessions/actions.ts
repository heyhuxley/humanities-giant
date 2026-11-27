'use server';

import { redirect } from 'next/navigation';
import { requireHost } from '../../../lib/auth/require-host';
import { createSession } from '../../../lib/sessions/create-session';
import { parseQuestionIds } from '../../../lib/sessions/parse-question-ids';

export type CreateSessionActionState = { error: string | null };

export async function createSessionAction(
  _previous: CreateSessionActionState,
  formData: FormData,
): Promise<CreateSessionActionState> {
  const hostId = await requireHost();
  const parsed = parseQuestionIds(formData);
  if (!parsed.ok) return { error: parsed.error };

  const result = await createSession(hostId, parsed.ids);
  if (!result.ok) {
    console.error('[create_session debug] createSession returned reason:', result.reason);
    if (result.reason === 'ownership') {
      return { error: 'One or more questions are not available. Refresh and try again.' };
    }
    return { error: 'Could not create the session. Try again.' };
  }

  redirect(`/host/sessions/${result.sessionId}`);
}
