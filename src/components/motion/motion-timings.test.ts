import { describe, expect, it } from 'vitest';
import {
  MOTION_TIMINGS,
  motionTimings,
  totalQuestionEnterMs,
} from './motion-timings';

describe('motion timings', () => {
  it('exports every timing as a finite positive number', () => {
    for (const duration of Object.values(MOTION_TIMINGS)) {
      expect(Number.isFinite(duration)).toBe(true);
      expect(duration).toBeGreaterThan(0);
    }
    expect(motionTimings).toBe(MOTION_TIMINGS);
  });

  it('keeps question entrance under 2500 milliseconds', () => {
    expect(totalQuestionEnterMs()).toBeLessThanOrEqual(2500);
  });

  it('keeps the correct reveal sequence under 2000 milliseconds', () => {
    const correctRevealSequence =
      MOTION_TIMINGS.correctFlash +
      MOTION_TIMINGS.ladderStep +
      MOTION_TIMINGS.countUp;
    expect(correctRevealSequence).toBeLessThanOrEqual(2000);
  });
});
