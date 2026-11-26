import type { LastResult, Option } from '../game/types';
import { correctCount, resultHeadline, usedLifelineNames } from '../lib/sessions/final-result-view';
import { describeFinishReason } from '../lib/sessions/reveal-view';

type Props = Readonly<{
  winnings: number | null;
  finishReason: string | null;
  position: number | null;
  lastResult: LastResult;
  correctIndex: Option | null;
  contestantName: string | null;
  lifelinesUsed: {
    fiftyFifty: boolean;
    phone: boolean;
    audience: boolean;
  };
  question: { text: string; options: [string, string, string, string] } | null;
}>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function FinalResult({
  winnings,
  finishReason,
  position,
  lastResult,
  correctIndex,
  contestantName,
  lifelinesUsed,
  question,
}: Props) {
  const names = usedLifelineNames(lifelinesUsed);

  return (
    <section
      aria-labelledby="final-result-heading"
      className="min-w-0 space-y-4 rounded-lg border border-stone-300 bg-white p-4"
    >
      <header className="min-w-0 space-y-2">
        <h2 id="final-result-heading" className="text-xl font-bold">Game over</h2>
        <p className="break-words text-lg font-semibold">
          {resultHeadline({ reason: finishReason, winnings, contestantName })}
        </p>
        <p>{describeFinishReason(finishReason)}</p>
        <p>
          {correctCount({ position: position ?? 0, lastResult })} of 15 questions answered correctly
        </p>
      </header>

      <div className="space-y-1">
        <h3 className="font-semibold">Lifelines used</h3>
        {names.length > 0 ? (
          <ul className="list-inside list-disc">
            {names.map((name) => <li key={name}>{name}</li>)}
          </ul>
        ) : (
          <p>No lifelines used</p>
        )}
      </div>

      {typeof correctIndex === 'number' && question !== null ? (
        <div className="min-w-0 space-y-2 border-t border-stone-200 pt-4">
          <h3 className="font-semibold">Last question</h3>
          <p className="break-words">{question.text}</p>
          <ol className="space-y-2">
            {question.options.map((option, index) => (
              <li key={index} className="min-w-0 break-words rounded border border-stone-300 p-3">
                <span className="font-semibold">{OPTION_LABELS[index]}.</span>{' '}
                {option}
                {correctIndex === index ? (
                  <span className="ml-2 font-semibold">✓ Correct answer</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
