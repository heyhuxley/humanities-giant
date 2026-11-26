'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Option } from '../../../game/types';
import { formatNaira } from '../../../lib/sessions/ladder-view';
import { describeResult, optionStates } from '../../../lib/sessions/reveal-view';

type PlayerActionState = { error: string | null };

type Props = Readonly<{
  sessionId: string;
  position: number | null;
  amountAtStake: number | null;
  question: { text: string; options: [string, string, string, string] };
  lockedAnswer: Option | null;
  correctIndex: Option | null;
  lastResult: 'correct' | 'wrong' | 'timeout' | null;
  status: string;
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
  correctIndex,
  lastResult,
  status,
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

  const finalized = status === 'revealed' || status === 'finished';
  const effectiveOpen = open && status === 'question_active' && !locallyExpired;
  const disabled = pending || lockedAnswer !== null || !effectiveOpen || finalized;
  const states = optionStates({
    lockedAnswer,
    correctIndex,
    revealed: finalized,
  });
  const resultMessage = finalized
    ? describeResult({ lastResult, role: 'contestant' })
    : null;

  return (
    <section className="space-y-4">
      {position !== null && amountAtStake !== null ? (
        <p className="font-medium">
          Question {position} <span aria-hidden="true">|</span>{' '}
          {formatNaira(amountAtStake)}
        </p>
      ) : null}
      <h2 className="text-lg font-semibold">{question.text}</h2>
      <div className="grid gap-2">
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const selected = tentative === optionIndex;
          const optionState = states[optionIndex];
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
                optionState.state === 'correct'
                  ? 'border-green-700 bg-green-100 font-semibold'
                  : optionState.state === 'wrong'
                    ? 'border-red-700 bg-red-100 font-semibold'
                    : optionState.state === 'locked'
                      ? 'border-amber-700 bg-amber-100 font-semibold'
                      : selected
                        ? 'border-blue-700 bg-blue-100'
                        : 'border-stone-300 bg-white'
              }`}
            >
              <span className="font-bold">{OPTION_LABELS[optionIndex]}.</span>{' '}
              {option}
              {optionState.icon ? (
                <span aria-hidden="true" className="ml-2">{optionState.icon}</span>
              ) : null}
              {optionState.label ? <span className="ml-1 font-semibold">{optionState.label}</span> : null}
            </button>
          );
        })}
      </div>

      {status === 'locked' ? (
        <p>Waiting for the host to reveal</p>
      ) : status === 'revealed' ? (
        <p>Waiting for the host to continue</p>
      ) : !finalized && !effectiveOpen ? (
        <p className="font-semibold">Time is up</p>
      ) : !finalized && tentative !== null && !confirming ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          className="min-h-11 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Final answer
        </button>
      ) : !finalized && confirming && tentative !== null ? (
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

      {resultMessage ? <p role="status">{resultMessage}</p> : null}
      {actionState.error ? (
        <p role="alert" className="text-red-700">{actionState.error}</p>
      ) : null}
    </section>
  );
}
