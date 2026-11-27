import { describe, expect, it } from 'vitest';
import { correctCount, resultHeadline, usedLifelineNames } from './final-result-view';

describe('correctCount', () => {
  it.each([
    [0, 'correct', 0],
    [5, 'correct', 5],
    [5, 'wrong', 4],
    [5, 'timeout', 4],
    [5, null, 4],
    [15, 'correct', 15],
    [16, 'correct', 15],
    [16, 'wrong', 15],
    [1, 'wrong', 0],
    [-1, 'correct', 0],
    [1.5, 'correct', 0],
    [Number.NaN, 'correct', 0],
  ] as const)('counts position %s after %s as %s', (position, lastResult, expected) => {
    expect(correctCount({ position, lastResult })).toBe(expected);
  });
});

describe('resultHeadline', () => {
  const winningsCases = [
    [0, '₦0'],
    [30_000, '₦30,000'],
    [100_000, '₦100,000'],
    [500_000, '₦500,000'],
    [null, '₦0'],
  ] as const;
  const reasonCases = [
    ['won', (name: string, amount: string) => `${name} won the top prize: ${amount}`],
    ['walked_away', (name: string, amount: string) => `${name} walked away with ${amount}`],
    ['wrong', (name: string, amount: string) => `${name} answered wrong and goes home with ${amount}`],
    ['timeout', (name: string, amount: string) => `Time ran out. ${name} goes home with ${amount}`],
    ['ended_by_host', (name: string, amount: string) => `The host ended the game. ${name} keeps ${amount}`],
    ['unknown', (name: string, amount: string) => `Game over. ${name} finishes with ${amount}`],
    [null, (name: string, amount: string) => `Game over. ${name} finishes with ${amount}`],
  ] as const;

  it.each(reasonCases.flatMap(([reason, expectedHeadline]) =>
    winningsCases.flatMap(([winnings, formattedAmount]) => [
      {
        reason,
        winnings,
        contestantName: 'Ada',
        expected: expectedHeadline('Ada', formattedAmount),
      },
      {
        reason,
        winnings,
        contestantName: null,
        expected: expectedHeadline('The contestant', formattedAmount),
      },
    ]),
  ))('describes $reason with winnings $winnings and contestantName $contestantName', ({
    reason,
    winnings,
    contestantName,
    expected,
  }) => {
    expect(resultHeadline({ reason, winnings, contestantName })).toBe(expected);
  });
});

describe('usedLifelineNames', () => {
  it('returns no names when no lifelines were used', () => {
    expect(usedLifelineNames({
      fiftyFifty: false,
      phone: false,
      audience: false,
    })).toEqual([]);
  });

  it.each([
    [{ fiftyFifty: true, phone: false, audience: false }, ['50:50']],
    [{ fiftyFifty: false, phone: true, audience: false }, ['Phone a friend']],
    [{ fiftyFifty: false, phone: false, audience: true }, ['Ask the audience']],
  ])('returns the names of the used lifelines', (used, expected) => {
    expect(usedLifelineNames(used)).toEqual(expected);
  });

  it('returns all used lifelines in display order', () => {
    expect(usedLifelineNames({
      fiftyFifty: true,
      phone: true,
      audience: true,
    })).toEqual(['50:50', 'Phone a friend', 'Ask the audience']);
  });
});
