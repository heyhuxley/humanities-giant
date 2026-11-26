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
  correctIndex,
  lastResult,
  status,
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

  const finalized = status === 'revealed' || status === 'finished';
  const effectiveOpen = open && status === 'question_active' && !locallyExpired;
  const disabled = pending || lockedAnswer !== null || !effectiveOpen || finalized;
  const states = optionStates({
    lockedAnswer,
    correctIndex,
    revealed: finalized,
  });
  const resultMessage = finalized
    ? describeResult({ lastResult, role: 'audience' })
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
      <form action={formAction} className="grid gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const chosen = votedOption === optionIndex;
          const optionState = states[optionIndex];
          return (
            <button
              key={optionIndex}
              type="submit"
              name="option"
              value={optionIndex}
              disabled={disabled}
              onClick={() => setVotedOption(optionIndex)}
              className={`min-h-11 rounded-lg border px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                optionState.state === 'correct'
                  ? 'border-green-700 bg-green-100 font-semibold'
                  : optionState.state === 'wrong'
                    ? 'border-red-700 bg-red-100 font-semibold'
                    : optionState.state === 'locked'
                      ? 'border-amber-700 bg-amber-100 font-semibold'
                      : chosen
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
              {chosen ? (
                <span className="ml-2 font-semibold">Your vote</span>
              ) : null}
            </button>
          );
        })}
      </form>
      {status === 'locked' ? (
        <p>Waiting for the host to reveal</p>
      ) : !finalized && !effectiveOpen ? (
        <p className="font-semibold">Voting closed</p>
      ) : null}
      {resultMessage ? <p role="status">{resultMessage}</p> : null}
      {actionState.error ? (
        <p role="alert" className="text-red-700">{actionState.error}</p>
      ) : null}
    </section>
  );
}
