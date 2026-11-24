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
  submitAction: (
    prev: PlayerActionState,
    formData: FormData,
  ) => Promise<PlayerActionState>;
}>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function ContestantPanel({
  sessionId,
  position,
  amountAtStake,
  question,
  lockedAnswer,
  open,
  submitAction,
}: Props) {
  const [tentative, setTentative] = useState<Option | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [locallyExpired, setLocallyExpired] = useState(false);
  const [actionState, formAction, pending] = useActionState(submitAnswer, {
    error: null,
  });

  async function submitAnswer(
    _previous: PlayerActionState,
    formData: FormData,
  ): Promise<PlayerActionState> {
    return submitAction(_previous, formData);
  }

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
      <div className="grid gap-2">
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const selected = tentative === optionIndex;
          const locked = lockedAnswer === optionIndex;
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={disabled}
              onClick={() => {
                setTentative(optionIndex);
                setConfirming(false);
              }}
              className={`min-h-11 rounded-lg border px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                locked
                  ? 'border-green-700 bg-green-100 font-semibold'
                  : selected
                    ? 'border-blue-700 bg-blue-100'
                    : 'border-stone-300 bg-white'
              }`}
            >
              <span className="font-bold">{OPTION_LABELS[optionIndex]}.</span>{' '}
              {option}
              {locked ? <span className="ml-2 font-semibold">Locked in</span> : null}
            </button>
          );
        })}
      </div>

      {lockedAnswer !== null ? (
        <p>Waiting for the host to reveal</p>
      ) : !effectiveOpen ? (
        <p className="font-semibold">Time is up</p>
      ) : tentative !== null && !confirming ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          className="min-h-11 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Final answer
        </button>
      ) : confirming && tentative !== null ? (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="option" value={tentative} />
          <p className="font-semibold">Lock in option {OPTION_LABELS[tentative]}?</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={disabled}
              className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirming(false)}
              className="min-h-11 flex-1 rounded-lg border border-stone-300 px-4 py-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Change
            </button>
          </div>
        </form>
      ) : null}

      {actionState.error ? (
        <p role="alert" className="text-red-700">{actionState.error}</p>
      ) : null}
    </section>
  );
}
