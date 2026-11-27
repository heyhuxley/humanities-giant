'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Option } from '../../../game/types';
import { LifelineResults } from '../../../components/lifeline-results';
import { AnswerSlab } from '../../../components/stage/answer-slab';
import { GiantNumeral } from '../../../components/stage/giant-numeral';
import { Spotlight } from '../../../components/stage/spotlight';
import { formatNaira } from '../../../lib/sessions/ladder-view';
import { optionAvailability } from '../../../lib/sessions/lifeline-view';
import type { PublicLifelines } from '../../../lib/sessions/read-public-state';
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
  lifelines: PublicLifelines;
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
  lifelines,
  voteAction,
}: Props) {
  const [votedOption, setVotedOption] = useState<Option | null>(null);
  const [locallyExpired, setLocallyExpired] = useState(false);
  const availableOptions = optionAvailability(lifelines.fiftyFifty.removed);
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
    <section className="space-y-5">
      {status !== 'question_active' && status !== 'locked' &&
      position !== null && amountAtStake !== null ? (
        <p className="font-display text-brass">
          Question {position} <span aria-hidden="true">|</span>{' '}
          {formatNaira(amountAtStake)}
        </p>
      ) : null}
      <div className="relative overflow-hidden border-y border-rule py-8 sm:py-10">
        <Spotlight>
          <div className="relative mx-auto max-w-3xl px-3 text-center">
            <GiantNumeral value={position ?? 0} />
            <h2 className="relative font-display text-lg font-semibold leading-snug text-bone text-pretty sm:text-xl">
              {question.text}
            </h2>
          </div>
        </Spotlight>
      </div>
      <LifelineResults lifelines={lifelines} />
      <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const chosen = votedOption === optionIndex;
          const optionState = states[optionIndex];
          const available = availableOptions[optionIndex];
          const removedLabelApplies =
            !available &&
            optionState.state !== 'correct' &&
            optionState.state !== 'wrong';
          const slabState = optionState.state === 'correct' || optionState.state === 'wrong' || optionState.state === 'locked'
            ? optionState.state
            : removedLabelApplies
              ? 'removed'
              : chosen
                ? 'selected'
                : 'neutral';
          return (
            <AnswerSlab
              key={optionIndex}
              letter={OPTION_LABELS[optionIndex]}
              text={option}
              state={slabState}
              icon={slabState === 'selected' ? '●' : slabState === 'removed' ? '✗' : optionState.icon || undefined}
              label={slabState === 'selected' ? 'Your vote' : slabState === 'removed' ? 'Removed' : optionState.label || undefined}
              ariaPressed={chosen}
              type="submit"
              name="option"
              value={optionIndex}
              disabled={disabled || !available}
              onClick={() => setVotedOption(optionIndex)}
            />
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
        <p role="alert" className="text-rose">{actionState.error}</p>
      ) : null}
    </section>
  );
}
