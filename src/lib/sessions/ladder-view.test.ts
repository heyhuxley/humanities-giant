import { describe, expect, it } from 'vitest';
import { MONEY_LADDER, MILESTONE_QUESTIONS } from '../../game/constants';
import { buildLadderRows, formatNaira } from './ladder-view';

describe('buildLadderRows', () => {
  it('returns all fifteen rows from question 15 down to question 1', () => {
    const rows = buildLadderRows({ position: 6, status: 'question_active', lastResult: null });
    expect(rows).toHaveLength(15);
    expect(rows.map((row) => row.position)).toEqual([
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(rows.map((row) => row.amount)).toEqual([...MONEY_LADDER].reverse());
  });

  it('marks guaranteed milestones from the game constants', () => {
    const rows = buildLadderRows({ position: 6, status: 'question_active', lastResult: null });
    expect(rows.filter((row) => row.isMilestone).map((row) => row.position))
      .toEqual([...MILESTONE_QUESTIONS].reverse());
  });

  it('marks completed positions below the active position as passed', () => {
    const rows = buildLadderRows({ position: 6, status: 'question_active', lastResult: null });
    expect(rows.find((row) => row.position === 5)?.state).toBe('passed');
    expect(rows.find((row) => row.position === 6)?.state).toBe('current');
    expect(rows.find((row) => row.position === 7)?.state).toBe('upcoming');
  });

  it('marks a correctly revealed current position as passed', () => {
    const rows = buildLadderRows({ position: 6, status: 'revealed', lastResult: 'correct' });
    expect(rows.find((row) => row.position === 6)?.state).toBe('passed');
    expect(rows.filter((row) => row.state === 'current')).toHaveLength(0);
  });

  it('keeps a wrongly revealed current position current', () => {
    const rows = buildLadderRows({ position: 6, status: 'revealed', lastResult: 'wrong' });
    expect(rows.find((row) => row.position === 5)?.state).toBe('passed');
    expect(rows.find((row) => row.position === 6)?.state).toBe('current');
  });

  it('marks every question passed after a correct reveal at question 15', () => {
    const rows = buildLadderRows({ position: 15, status: 'finished', lastResult: 'correct' });
    expect(rows.every((row) => row.state === 'passed')).toBe(true);
  });

  it.each([
    ['position zero', 0, 'question_active', 'correct'],
    ['waiting status', 6, 'waiting', 'correct'],
    ['position 16', 16, 'revealed', 'correct'],
    ['negative position', -1, 'revealed', 'correct'],
    ['fractional position', 1.5, 'revealed', 'correct'],
    ['not a number', Number.NaN, 'revealed', 'correct'],
  ] as const)('marks every row upcoming for %s', (_label, position, status, lastResult) => {
    const rows = buildLadderRows({ position, status, lastResult });
    expect(rows.every((row) => row.state === 'upcoming')).toBe(true);
  });
});

describe('formatNaira', () => {
  it.each([
    [0, '₦0'],
    [500, '₦500'],
    [5_000, '₦5,000'],
    [30_000, '₦30,000'],
    [500_000, '₦500,000'],
  ])('formats %s naira', (amount, formatted) => {
    expect(formatNaira(amount)).toBe(formatted);
  });
});
