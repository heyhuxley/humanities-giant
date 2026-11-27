import { buildLadderRows, formatNaira } from '../lib/sessions/ladder-view';

export function MoneyLadder({
  position,
  status,
  lastResult,
}: Readonly<{
  position: number;
  status: string;
  lastResult: 'correct' | 'wrong' | 'timeout' | null;
}>) {
  const rows = buildLadderRows({ position, status, lastResult });

  return (
    <nav aria-label="Money ladder" className="min-w-0 rounded-sm border border-rule bg-slab p-3">
      <h2 className="mb-3 font-display text-xl font-semibold text-bone">Money ladder</h2>
      <ol className="grid grid-cols-1 gap-2">
        {rows.map((row) => (
          <li
            key={row.position}
            aria-current={row.state === 'current' ? 'true' : undefined}
            className={`flex min-w-0 flex-col gap-1 rounded-sm border px-2 py-2 ${
              row.state === 'current'
                ? 'border-brass bg-slab-raised font-semibold text-bone'
                : row.state === 'passed'
                  ? 'border-rule bg-ink text-bone-muted'
                  : 'border-rule text-bone-muted'
            }`}
          >
            <span className="min-w-0 break-words text-sm">
              <span>Question {row.position}</span>
              {row.isMilestone ? <span className="ml-2 font-semibold text-brass">Guaranteed</span> : null}
            </span>
            <span className="flex min-w-0 flex-wrap items-center justify-between gap-1">
              {row.state === 'current' ? (
                <span className="font-semibold text-brass">
                  <span aria-hidden="true">▸ </span>Current
                </span>
              ) : null}
              {row.state === 'passed' ? <span className="mr-2">✓ Passed</span> : null}
              <span className="shrink-0 text-right font-display tabular-nums text-brass">
                {formatNaira(row.amount)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
