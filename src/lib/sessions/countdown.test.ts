import { describe, expect, it } from 'vitest';
import {
  computeClockOffset,
  estimateServerNow,
  isExpired,
  remainingMs,
  secondsLeft,
} from './countdown';

describe('countdown', () => {
  it('computes positive, negative and zero offsets', () => {
    expect(computeClockOffset(12_000, 10_000)).toBe(2_000);
    expect(computeClockOffset(8_000, 10_000)).toBe(-2_000);
    expect(computeClockOffset(10_000, 10_000)).toBe(0);
  });

  it('corrects a phone clock ahead and behind', () => {
    expect(estimateServerNow(12_000, -2_000)).toBe(10_000);
    expect(estimateServerNow(8_000, 2_000)).toBe(10_000);
  });

  it('handles the exact deadline and one millisecond before it', () => {
    expect(remainingMs(10_000, 10_000)).toBe(0);
    expect(isExpired(10_000, 10_000)).toBe(true);
    expect(remainingMs(10_000, 9_999)).toBe(1);
    expect(isExpired(10_000, 9_999)).toBe(false);
    expect(secondsLeft(1)).toBe(1);
  });

  it('never returns negative remaining milliseconds or negative seconds', () => {
    expect(remainingMs(10_000, 11_000)).toBe(0);
    expect(secondsLeft(-1)).toBe(0);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    undefined,
  ])('handles non finite input %s', (value) => {
    expect(computeClockOffset(value as number, 10_000)).toBe(0);
    expect(estimateServerNow(value as number, 10)).toBe(0);
    expect(remainingMs(value as number, 10)).toBe(0);
    expect(secondsLeft(value as number)).toBe(0);
    expect(isExpired(value as number, 10)).toBe(false);
  });
});
