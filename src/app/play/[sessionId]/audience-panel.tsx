'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Option } from '../../../game/types';

type PlayerActionState = { error: string | null };

type Props = Readonly<{
  sessionId: string;
  position: number | null;
  amountAtStake: number | null;
  question: { text: string; options: [string, string, string, string] };
  lockedAnswer: Option | null;
  open: boolean;
  voteAction: (
    prev: PlayerActionState,
    formData: FormData,
  ) => Promise<PlayerActionState>;
}>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function AudiencePanel({
  sessionId,
  position,
  amountAtStake,
  question,
  lockedAnswer,
  open,
  voteAction,
}: Props) {
  const [votedOption, setVotedOption] = useState<Option | null>(null);
  const [locallyExpired, setLocallyExpired] = useState(false);
  const [actionState, formAction, pending] = useActionState(voteAction, {
    error: null,
  });
  useEffect(() => {
    const onExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ sessionId: string }>;
      if (customEvent.detail.sessionId === sessionId) setLocallyExpired(true);
    };
    globalThis.addEventListener('humanities-countdown-expired', onExpired);
    return () => globalThis.removeEventListener('humanities-countdown-expired', onExpired);
  }, [sessionId]);

  const effectiveOpen = open && !locallyExpired;
  const disabled = pending || lockedAnswer !== null || !effectiveOpen;

  return (
    <section className="space-y-4">
      {position !== null && amountAtStake !== null ? (
        <p className="font-medium">
          Question {position} <span aria-hidden="true">|</span>{' '}
          ₦{amountAtStake.toLocaleString('en-NG')}
        </p>
      ) : null}
      <h2 className="text-lg font-semibold">{question.text}</h2>
      <form action={formAction} className="grid gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const chosen = votedOption === optionIndex;
          const contestantLocked = lockedAnswer === optionIndex;
          return (
            <button
              key={optionIndex}
              type="submit"
              name="option"
              value={optionIndex}
              disabled={disabled}
              onClick={() => setVotedOption(optionIndex)}
              className={`min-h-11 rounded-lg border px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                contestantLocked
                  ? 'border-green-700 bg-green-100 font-semibold'
                  : chosen
                    ? 'border-blue-700 bg-blue-100'
                    : 'border-stone-300 bg-white'
              }`}
            >
              <span className="font-bold">{OPTION_LABELS[optionIndex]}.</span>{' '}
              {option}
              {contestantLocked ? (
                <span className="ml-2 font-semibold">Contestant locked in</span>
              ) : chosen ? (
                <span className="ml-2 font-semibold">Your vote</span>
              ) : null}
            </button>
          );
        })}
      </form>
      {lockedAnswer !== null ? (
        <p>Waiting for the host to reveal</p>
      ) : !effectiveOpen ? (
        <p className="font-semibold">Voting closed</p>
      ) : null}
      {actionState.error ? (
        <p role="alert" className="text-red-700">{actionState.error}</p>
      ) : null}
    </section>
  );
}
