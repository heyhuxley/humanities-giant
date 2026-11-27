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
type LifelineName = 'fifty_fifty' | 'phone' | 'audience';

type LifelineChoice = {
  name: LifelineName;
  label: string;
};

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
  submitAction: (
    prev: PlayerActionState,
    formData: FormData,
  ) => Promise<PlayerActionState>;
  lifelineAction: (
    prev: PlayerActionState,
    formData: FormData,
  ) => Promise<PlayerActionState>;
  walkAwayAction: (
    prev: PlayerActionState,
    formData: FormData,
  ) => Promise<PlayerActionState>;
  walkAwayAmount: number | null;
}>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const LIFELINE_CHOICES: readonly LifelineChoice[] = [
  { name: 'fifty_fifty', label: '50:50' },
  { name: 'phone', label: 'Phone a friend' },
  { name: 'audience', label: 'Ask the audience' },
];

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
  lifelines,
  submitAction,
  lifelineAction,
  walkAwayAction,
  walkAwayAmount,
}: Props) {
  const [tentative, setTentative] = useState<Option | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedLifeline, setSelectedLifeline] = useState<LifelineChoice | null>(null);
  const [locallyExpired, setLocallyExpired] = useState(false);
  const [previousRemovedOptionsKey, setPreviousRemovedOptionsKey] = useState(
    lifelines.fiftyFifty.removed?.join(',') ?? '',
  );
  const [actionState, formAction, pending] = useActionState(submitAnswer, {
    error: null,
  });
  const [lifelineActionState, lifelineFormAction, lifelinePending] = useActionState(
    submitLifeline,
    { error: null },
  );
  const [walkAwayConfirming, setWalkAwayConfirming] = useState(false);
  const [walkAwayActionState, walkAwayFormAction, walkAwayPending] = useActionState(
    walkAwayAction,
    { error: null },
  );
  const availableOptions = optionAvailability(lifelines.fiftyFifty.removed);
  const removedOptionsKey = lifelines.fiftyFifty.removed?.join(',') ?? '';

  if (previousRemovedOptionsKey !== removedOptionsKey) {
    setPreviousRemovedOptionsKey(removedOptionsKey);
    if (tentative !== null && !availableOptions[tentative]) {
      setTentative(null);
      setConfirming(false);
    }
  }

  async function submitAnswer(
    _previous: PlayerActionState,
    formData: FormData,
  ): Promise<PlayerActionState> {
    return submitAction(_previous, formData);
  }

  async function submitLifeline(
    previous: PlayerActionState,
    formData: FormData,
  ): Promise<PlayerActionState> {
    const result = await lifelineAction(previous, formData);
    if (result.error === null) setSelectedLifeline(null);
    return result;
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
            <h2 data-stage="question" className="relative font-display text-lg font-semibold leading-snug text-bone text-pretty sm:text-xl">
              {question.text}
            </h2>
          </div>
        </Spotlight>
      </div>
      <LifelineResults lifelines={lifelines} />
      {selectedLifeline === null ? (
        <div className="grid grid-cols-3 gap-2">
          {LIFELINE_CHOICES.map((choice) => {
            const used = lifelines[
              choice.name === 'fifty_fifty' ? 'fiftyFifty' : choice.name
            ].used;
            const lifelineDisabled = used ||
              !effectiveOpen ||
              lockedAnswer !== null ||
              pending ||
              lifelinePending;
            return (
              <button
                key={choice.name}
                type="button"
                disabled={lifelineDisabled}
                aria-disabled={lifelineDisabled}
                onClick={() => setSelectedLifeline(choice)}
                className="press min-h-11 rounded-sm border border-rule bg-slab px-2 py-2 font-semibold text-bone hover:bg-slab-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                {choice.label}
                {used ? (
                  <span className="ml-1 inline-flex items-center gap-1">
                    <span aria-hidden="true">✗</span>
                    <span>Used</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div
          role="alert"
          className="space-y-2 rounded-sm border border-rule bg-slab p-3"
        >
          <p>Use {selectedLifeline.label}?</p>
          <form action={lifelineFormAction} className="flex gap-2">
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="lifeline" value={selectedLifeline.name} />
            <button
              type="submit"
              disabled={
                pending ||
                lifelinePending ||
                !effectiveOpen ||
                lockedAnswer !== null
              }
              className="press min-h-11 flex-1 rounded-sm border border-ember bg-ember px-4 py-3 font-semibold text-ink hover:bg-ember/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={lifelinePending}
              onClick={() => setSelectedLifeline(null)}
              className="press min-h-11 flex-1 rounded-sm border border-rule bg-slab px-4 py-3 font-semibold text-bone hover:bg-slab-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
      {lifelineActionState.error ? (
        <p role="alert" className="text-rose">{lifelineActionState.error}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const selected = tentative === optionIndex;
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
              : selected
                ? 'selected'
                : 'neutral';
          return (
            <AnswerSlab
              key={optionIndex}
              letter={OPTION_LABELS[optionIndex]}
              text={option}
              state={slabState}
              icon={slabState === 'selected' ? '●' : slabState === 'removed' ? '✗' : optionState.icon || undefined}
              label={slabState === 'selected' ? 'Selected' : slabState === 'removed' ? 'Removed' : optionState.label || undefined}
              ariaPressed={selected}
              type="button"
              disabled={disabled || !available}
              onClick={() => {
                setTentative(optionIndex);
                setConfirming(false);
              }}
            />
          );
        })}
      </div>

      {status === 'locked' ? (
        <p>Waiting for the host to reveal</p>
      ) : status === 'revealed' ? (
        <div className="space-y-2">
          <p>Waiting for the host to continue</p>
          {walkAwayAmount !== null ? (
            <div className="space-y-2">
              {!walkAwayConfirming ? (
                <button
                  type="button"
                  disabled={walkAwayPending}
                  onClick={() => setWalkAwayConfirming(true)}
                  className="press min-h-11 w-full rounded-sm border border-rule bg-slab px-4 py-3 text-left font-semibold text-bone hover:bg-slab-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Walk away with {formatNaira(walkAwayAmount)}
                </button>
              ) : (
                <div role="alert" className="space-y-2 rounded-sm border border-rule bg-slab p-3">
                  <p>
                    Walk away with {formatNaira(walkAwayAmount)}? This ends the game for everyone.
                  </p>
                  <form action={walkAwayFormAction} className="flex gap-2">
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <button
                      type="submit"
                      disabled={walkAwayPending}
                      className="press min-h-11 flex-1 rounded-sm border border-ember bg-ember px-4 py-3 font-semibold text-ink hover:bg-ember/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={walkAwayPending}
                      onClick={() => setWalkAwayConfirming(false)}
                      className="press min-h-11 flex-1 rounded-sm border border-rule bg-slab px-4 py-3 font-semibold text-bone hover:bg-slab-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
              {walkAwayActionState.error ? (
                <p role="alert" className="text-rose">{walkAwayActionState.error}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : !finalized && !effectiveOpen ? (
        <p className="font-semibold">Time is up</p>
      ) : !finalized && tentative !== null && !confirming ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          className="press min-h-11 w-full rounded-sm border border-ember bg-ember px-4 py-3 font-semibold text-ink hover:bg-ember/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
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
              className="press min-h-11 flex-1 rounded-sm border border-ember bg-ember px-4 py-3 font-semibold text-ink hover:bg-ember/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirming(false)}
              className="press min-h-11 flex-1 rounded-sm border border-rule bg-slab px-4 py-3 font-semibold text-bone hover:bg-slab-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Change
            </button>
          </div>
        </form>
      ) : null}

      {resultMessage ? <p role="status">{resultMessage}</p> : null}
      {actionState.error ? (
        <p role="alert" className="text-rose">{actionState.error}</p>
      ) : null}
    </section>
  );
}
