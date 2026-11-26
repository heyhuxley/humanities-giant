'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Option } from '../../../game/types';
import { LifelineResults } from '../../../components/lifeline-results';
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
    <section className="space-y-4">
      {position !== null && amountAtStake !== null ? (
        <p className="font-medium">
          Question {position} <span aria-hidden="true">|</span>{' '}
          {formatNaira(amountAtStake)}
        </p>
      ) : null}
      <h2 className="text-lg font-semibold">{question.text}</h2>
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
                className="min-h-11 rounded-lg border border-stone-300 bg-white px-2 py-2 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="space-y-2 rounded-lg border border-stone-300 p-3"
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
              className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={lifelinePending}
              onClick={() => setSelectedLifeline(null)}
              className="min-h-11 flex-1 rounded-lg border border-stone-300 px-4 py-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
      {lifelineActionState.error ? (
        <p role="alert" className="text-red-700">{lifelineActionState.error}</p>
      ) : null}
      <div className="grid gap-2">
        {question.options.map((option, index) => {
          const optionIndex = index as Option;
          const selected = tentative === optionIndex;
          const optionState = states[optionIndex];
          const available = availableOptions[optionIndex];
          const removedLabelApplies =
            !available &&
            optionState.state !== 'correct' &&
            optionState.state !== 'wrong';
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={disabled || !available}
              onClick={() => {
                setTentative(optionIndex);
                setConfirming(false);
              }}
              className={`min-h-11 rounded-lg border px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                optionState.state === 'correct'
                  ? 'border-green-700 bg-green-100 font-semibold'
                  : optionState.state === 'wrong'
                    ? 'border-red-700 bg-red-100 font-semibold'
                    : !available
                      ? 'border-stone-400 bg-stone-100 text-stone-500'
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
              {removedLabelApplies ? (
                <span aria-hidden="true" className="ml-2">✗</span>
              ) : null}
              {optionState.label ? <span className="ml-1 font-semibold">{optionState.label}</span> : null}
              {removedLabelApplies ? (
                <span className="ml-1 font-semibold">Removed</span>
              ) : null}
            </button>
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
                  className="min-h-11 w-full rounded-lg border border-stone-300 px-4 py-3 text-left font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Walk away with {formatNaira(walkAwayAmount)}
                </button>
              ) : (
                <div role="alert" className="space-y-2 rounded-lg border border-stone-300 p-3">
                  <p>
                    Walk away with {formatNaira(walkAwayAmount)}? This ends the game for everyone.
                  </p>
                  <form action={walkAwayFormAction} className="flex gap-2">
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <button
                      type="submit"
                      disabled={walkAwayPending}
                      className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={walkAwayPending}
                      onClick={() => setWalkAwayConfirming(false)}
                      className="min-h-11 flex-1 rounded-lg border border-stone-300 px-4 py-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
              {walkAwayActionState.error ? (
                <p role="alert" className="text-red-700">{walkAwayActionState.error}</p>
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
