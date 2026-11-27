'use server';

import { revalidatePath } from 'next/cache';
import { requireHost } from '@/lib/auth/require-host';
import {
  describeNextResult,
  describeRevealResult,
  describeRunResult,
} from '@/lib/sessions/run-result-messages';
import { createRunSessionEventDeps } from '@/lib/sessions/session-event-deps';
import {
  parseEndSessionForm,
  parseNextForm,
  parseRevealForm,
  parseSetContestantForm,
  parseStartForm,
} from '@/lib/sessions/host-event-form';
import { runSessionEvent } from '@/lib/sessions/run-session-event';
import type { RevealRequest } from '@/lib/sessions/run-session-event';

export type HostEventActionState = { error: string | null };

export async function setContestantAction(
  _previous: HostEventActionState,
  formData: FormData,
): Promise<HostEventActionState> {
  const hostId = await requireHost();
  const parsed = parseSetContestantForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const result = await runSessionEvent(createRunSessionEventDeps(), {
    sessionId: parsed.sessionId,
    event: {
      type: 'set_contestant',
      actor: { id: hostId, role: 'host' },
      participantId: parsed.participantId,
    },
  });
  if (!result.ok) return { error: describeRunResult(result) };

  revalidatePath(`/host/sessions/${parsed.sessionId}`);
  return { error: null };
}

export async function startSessionAction(
  _previous: HostEventActionState,
  formData: FormData,
): Promise<HostEventActionState> {
  const hostId = await requireHost();
  const parsed = parseStartForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const result = await runSessionEvent(createRunSessionEventDeps(), {
    sessionId: parsed.sessionId,
    event: {
      type: 'start',
      actor: { id: hostId, role: 'host' },
    },
  });
  if (!result.ok) return { error: describeRunResult(result) };

  revalidatePath(`/host/sessions/${parsed.sessionId}`);
  return { error: null };
}

export async function endSessionAction(
  _previous: HostEventActionState,
  formData: FormData,
): Promise<HostEventActionState> {
  const hostId = await requireHost();
  const parsed = parseEndSessionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const result = await runSessionEvent(createRunSessionEventDeps(), {
    sessionId: parsed.sessionId,
    event: {
      type: 'end_session',
      actor: { id: hostId, role: 'host' },
    },
  });
  if (!result.ok) {
    const error = result.reason === 'rejected' && result.error === 'wrong_state'
      ? 'This session has already finished.'
      : describeRunResult(result);
    return { error };
  }

  revalidatePath(`/host/sessions/${parsed.sessionId}`);
  return { error: null };
}

export async function revealAction(
  _previous: HostEventActionState,
  formData: FormData,
): Promise<HostEventActionState> {
  const hostId = await requireHost();
  const parsed = parseRevealForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const event: RevealRequest = {
    type: 'reveal',
    actor: { id: hostId, role: 'host' },
  };
  const result = await runSessionEvent(createRunSessionEventDeps(), {
    sessionId: parsed.sessionId,
    event,
  });
  if (!result.ok) return { error: describeRevealResult(result) };

  revalidatePath(`/host/sessions/${parsed.sessionId}`);
  return { error: null };
}

export async function nextAction(
  _previous: HostEventActionState,
  formData: FormData,
): Promise<HostEventActionState> {
  const hostId = await requireHost();
  const parsed = parseNextForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const result = await runSessionEvent(createRunSessionEventDeps(), {
    sessionId: parsed.sessionId,
    event: {
      type: 'next',
      actor: { id: hostId, role: 'host' },
    },
  });
  if (!result.ok) return { error: describeNextResult(result) };

  revalidatePath(`/host/sessions/${parsed.sessionId}`);
  return { error: null };
}
