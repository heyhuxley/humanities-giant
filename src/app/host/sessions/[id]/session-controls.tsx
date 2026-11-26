'use client';

import { useActionState, useState } from 'react';
import {
  endSessionAction,
  nextAction,
  revealAction,
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

export function EndSessionControl({ sessionId }: Readonly<{ sessionId: string }>) {
  const [state, formAction, pending] = useActionState(endSessionAction, INITIAL_STATE);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setIsConfirming(true)}
        className="rounded border border-red-700 px-4 py-2 text-red-700 disabled:opacity-50"
      >
        End session
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p role="alert">End the session for everyone? This can&apos;t be undone.</p>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Ending…' : 'Yes, end it'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setIsConfirming(false)}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          Cancel
        </button>
        {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      </form>
    </div>
  );
}

export function RevealControl({ sessionId }: Readonly<{ sessionId: string }>) {
  const [state, formAction, pending] = useActionState(revealAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Revealing…' : 'Reveal answer'}
      </button>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function NextControl({ sessionId }: Readonly<{ sessionId: string }>) {
  const [state, formAction, pending] = useActionState(nextAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Moving on…' : 'Next question'}
      </button>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}
