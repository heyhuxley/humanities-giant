import { describe, expect, it } from 'vitest';
import { audiencePercentages } from './audience-percentages';

describe('audiencePercentages', () => {
  it.each([
    { counts: [3, 0, 0, 0] as [number, number, number, number], expected: [100, 0, 0, 0] },
    { counts: [2, 2, 0, 0] as [number, number, number, number], expected: [50, 50, 0, 0] },
    { counts: [1, 1, 0, 0] as [number, number, number, number], under: true },
    { counts: [1, 1, 1, 0] as [number, number, number, number], expected: [34, 33, 33, 0] },
    { counts: [3, 0, 0, 0] as [number, number, number, number], expected: [100, 0, 0, 0] },
    { counts: [0, 0, 0, 0] as [number, number, number, number], under: true },
    { counts: [0, 0, 0, 8] as [number, number, number, number], expected: [0, 0, 0, 100] },
  ])('calculates percentages for $counts', ({ counts, expected, under }) => {
    const result = audiencePercentages(counts);
    if (under) expect(result).toEqual({ notEnoughVotes: true, percentages: null });
    else expect(result).toEqual({ notEnoughVotes: false, percentages: expected });
  });

  it('sums every eligible count combination to 100 and resolves fractional ties by option order', () => {
    for (let a = 0; a <= 6; a += 1) for (let b = 0; b <= 6; b += 1) for (let c = 0; c <= 6; c += 1) for (let d = 0; d <= 6; d += 1) {
      const counts: [number, number, number, number] = [a, b, c, d];
      if (a + b + c + d < 3) continue;
      const result = audiencePercentages(counts);
      expect(result.notEnoughVotes).toBe(false);
      if (result.percentages === null) throw new Error('Expected percentages for at least three votes');
      expect(result.percentages.reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(result.percentages.every(Number.isInteger)).toBe(true);

      const total = counts.reduce((sum, value) => sum + value, 0);
      const floors = counts.map((count) => Math.floor((count * 100) / total));
      const remainderOrder = counts.map((count, index) => ({ index, remainder: (count * 100) % total }))
        .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
      const extras = 100 - floors.reduce((sum, value) => sum + value, 0);
      const expected = [...floors];
      for (let index = 0; index < extras; index += 1) expected[remainderOrder[index].index] += 1;
      expect(result.percentages).toEqual(expected);
    }
  });
});
