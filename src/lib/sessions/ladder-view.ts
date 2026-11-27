import { MILESTONE_QUESTIONS, MONEY_LADDER } from '../../game/constants';

export type LadderRow = {
  position: number;
  amount: number;
  isMilestone: boolean;
  state: 'passed' | 'current' | 'upcoming';
};

export function amountAtPosition(position: number): number {
  if (!Number.isInteger(position) || position < 1 || position > MONEY_LADDER.length) return 0;
  return MONEY_LADDER[position - 1] ?? 0;
}

export function buildLadderRows(input: {
  position: number;
  status: string;
  lastResult: 'correct' | 'wrong' | 'timeout' | null;
}): LadderRow[] {
  const validPosition =
    Number.isInteger(input.position) && input.position >= 1 && input.position <= MONEY_LADDER.length;

  return MONEY_LADDER.map((amount, index) => {
    const position = index + 1;
    const passed =
      validPosition &&
      input.status !== 'waiting' &&
      (position < input.position ||
        (position === input.position && input.lastResult === 'correct'));
    const state: LadderRow['state'] = !validPosition || input.status === 'waiting'
      ? 'upcoming'
      : passed
        ? 'passed'
        : position === input.position
          ? 'current'
          : 'upcoming';

    return {
      position,
      amount,
      isMilestone: MILESTONE_QUESTIONS.some((milestone) => milestone === position),
      state,
    };
  }).reverse();
}

export function formatNaira(amount: number): string {
  return `₦${new Intl.NumberFormat('en-NG').format(amount)}`;
}
