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
    <nav aria-label="Money ladder" className="min-w-0">
      <h2 className="mb-2 text-lg font-semibold">Money ladder</h2>
      <ol className="grid gap-1">
        {rows.map((row) => (
          <li
            key={row.position}
            aria-current={row.state === 'current' ? 'true' : undefined}
            className={`flex min-w-0 items-center justify-between gap-3 rounded border px-3 py-2 ${
              row.state === 'current'
                ? 'border-blue-700 bg-blue-50 font-semibold'
                : row.state === 'passed'
                  ? 'border-stone-200 bg-stone-50 text-stone-600'
                  : 'border-stone-200'
            }`}
          >
            <span className="min-w-0 break-words">
              <span>Question {row.position}</span>
              {row.isMilestone ? <span className="ml-2 text-sm">Guaranteed</span> : null}
            </span>
            <span className="shrink-0 text-right">
              {row.state === 'current' ? <span className="mr-2">Current</span> : null}
              {row.state === 'passed' ? <span className="mr-2">✓ Passed</span> : null}
              {formatNaira(row.amount)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
