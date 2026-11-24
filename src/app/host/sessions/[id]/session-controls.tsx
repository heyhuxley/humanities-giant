'use client';

import { useActionState } from 'react';
import {
  setContestantAction,
  startSessionAction,
  type HostEventActionState,
} from './actions';

const INITIAL_STATE: HostEventActionState = { error: null };

export function SetContestantForm({
  sessionId,
  participantId,
}: Readonly<{
    sessionId: string;
    participantId: string;
}>) {
  const [state, formAction, pending] = useActionState(setContestantAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="participantId" value={participantId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border px-3 py-1 disabled:opacity-50"
      >
        {pending ? 'Updating…' : 'Make contestant'}
      </button>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function StartSessionForm({
  sessionId,
  hasContestant,
}: {
  sessionId: string;
  hasContestant: boolean;
}) {
  const [state, formAction, pending] = useActionState(startSessionAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        disabled={!hasContestant || pending}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Start'}
      </button>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}
