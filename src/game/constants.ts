export const MONEY_LADDER = [
  5_000, 10_000, 15_000, 20_000, 30_000,
  40_000, 50_000, 60_000, 75_000, 100_000,
  150_000, 200_000, 300_000, 400_000, 500_000,
] as const;

export const MILESTONE_QUESTIONS = [5, 10] as const;
export const QUESTION_DURATION_MS = 30_000;

export const WINNINGS_ON_LOSS = [
  { fromPosition: 1, toPosition: 5, winnings: 0 },
  { fromPosition: 6, toPosition: 10, winnings: 30_000 },
  { fromPosition: 11, toPosition: 15, winnings: 100_000 },
] as const;

export function getWinningsOnLoss(position: number): number {
  return WINNINGS_ON_LOSS.find(
    (range) => position >= range.fromPosition && position <= range.toPosition,
  )?.winnings ?? 0;
}
