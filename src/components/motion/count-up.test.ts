import { describe, expect, it } from 'vitest';
import { countUpValue } from './count-up';

describe('countUpValue', () => {
  it('returns the exact endpoints', () => {
    expect(countUpValue(5000, 10000, 0)).toBe(5000);
    expect(countUpValue(5000, 10000, 1)).toBe(10000);
  });

  it.each([
    ['rising', 0, 500000, 1],
    ['falling', 500000, 0, -1],
  ])('moves monotonically while %s', (_direction, prev, next, sign) => {
    let previousValue = prev;
    for (let index = 0; index <= 1000; index += 1) {
      const value = countUpValue(prev, next, index / 1000);
      expect(Number.isInteger(value)).toBe(true);
      if (sign === 1) expect(value).toBeGreaterThanOrEqual(previousValue);
      else expect(value).toBeLessThanOrEqual(previousValue);
      previousValue = value;
    }
    expect(previousValue).toBe(next);
  });

  it('clamps progress and treats non-finite progress as complete', () => {
    expect(countUpValue(100, 200, -1)).toBe(100);
    expect(countUpValue(100, 200, 2)).toBe(200);
    expect(countUpValue(100, 200, Number.NaN)).toBe(200);
    expect(countUpValue(100, 200, Number.POSITIVE_INFINITY)).toBe(200);
  });

  it('handles equal amounts and returns integer values', () => {
    expect(countUpValue(500000, 500000, 0.5)).toBe(500000);
    expect(Number.isInteger(countUpValue(100, 205, 0.333))).toBe(true);
  });

  it('uses the finite amount when either amount is not finite', () => {
    expect(countUpValue(Number.NaN, 500000, 0)).toBe(500000);
    expect(countUpValue(500000, Number.POSITIVE_INFINITY, 1)).toBe(500000);
    expect(countUpValue(Number.NaN, Number.NEGATIVE_INFINITY, 0.5)).toBe(0);
  });

  it('counts large naira amounts without losing the destination', () => {
    expect(countUpValue(0, 500000, 1)).toBe(500000);
    expect(countUpValue(0, 500000, 0.5)).toBe(250000);
  });
});
