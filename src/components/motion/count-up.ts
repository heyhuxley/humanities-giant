export function countUpValue(prev: number, next: number, progress: number): number {
  const prevIsFinite = Number.isFinite(prev);
  const nextIsFinite = Number.isFinite(next);

  if (!prevIsFinite || !nextIsFinite) {
    if (prevIsFinite) return prev;
    if (nextIsFinite) return next;
    return 0;
  }

  const boundedProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 1;
  if (boundedProgress === 0) return prev;
  if (boundedProgress === 1) return next;

  return Math.round(prev * (1 - boundedProgress) + next * boundedProgress);
}
