import {
  audienceBarRows,
  optionAvailability,
  phoneHintMessage,
} from '../lib/sessions/lifeline-view';
import type { PublicLifelines } from '../lib/sessions/read-public-state';

type Props = Readonly<{
  lifelines: PublicLifelines;
}>;

export function LifelineResults({ lifelines }: Props) {
  const phoneMessage = phoneHintMessage(lifelines.phone.hint);
  const audienceResult = audienceBarRows(
    lifelines.audience.percentages,
    lifelines.audience.notEnoughVotes,
  );
  const hasRemovedOptions = optionAvailability(lifelines.fiftyFifty.removed)
    .some((available) => !available);

  if (phoneMessage === null && audienceResult === null && !hasRemovedOptions) return null;

  return (
    <div className="space-y-2 rounded-sm border border-rule bg-slab p-3 text-sm text-bone">
      {phoneMessage !== null ? <p>{phoneMessage}</p> : null}
      {audienceResult?.kind === 'bars' ? (
        <div
          role="img"
          aria-label={`Audience percentages: ${audienceResult.rows.map((row) => row.text).join(', ')}`}
          className="space-y-1"
        >
          {audienceResult.rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-16 shrink-0">{row.text}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-sm bg-slab-raised">
                <div
                  className="h-full bg-ember"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {audienceResult?.kind === 'not_enough' ? <p>{audienceResult.text}</p> : null}
      {hasRemovedOptions ? <p>50:50: two answers removed</p> : null}
    </div>
  );
}
