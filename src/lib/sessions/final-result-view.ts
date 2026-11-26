import type { LastResult } from '../../game/types';
import { formatNaira } from './ladder-view';

export function correctCount(input: {
  position: number;
  lastResult: LastResult;
}): number {
  if (!Number.isInteger(input.position) || input.position <= 0) return 0;
  if (input.lastResult === 'correct') return Math.min(input.position, 15);
  return Math.max(input.position - 1, 0);
}

export function resultHeadline(input: {
  reason: string | null;
  winnings: number | null;
  contestantName: string | null;
}): string {
  const name = input.contestantName || 'The contestant';
  const amount = formatNaira(input.winnings ?? 0);

  if (input.reason === 'won') return `${name} won the top prize: ${amount}`;
  if (input.reason === 'walked_away') return `${name} walked away with ${amount}`;
  if (input.reason === 'wrong') return `${name} answered wrong and goes home with ${amount}`;
  if (input.reason === 'timeout') return `Time ran out. ${name} goes home with ${amount}`;
  if (input.reason === 'ended_by_host') return `The host ended the game. ${name} keeps ${amount}`;
  return `Game over. ${name} finishes with ${amount}`;
}

export function usedLifelineNames(used: {
  fiftyFifty: boolean;
  phone: boolean;
  audience: boolean;
}): string[] {
  const names: string[] = [];
  if (used.fiftyFifty) names.push('50:50');
  if (used.phone) names.push('Phone a friend');
  if (used.audience) names.push('Ask the audience');
  return names;
}
