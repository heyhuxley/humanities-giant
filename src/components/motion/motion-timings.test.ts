import { describe, expect, it } from 'vitest';
import {
  MOTION_TIMINGS,
  finalLineDuration,
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

  it('keeps the reveal and result timings on their authored values', () => {
    expect(MOTION_TIMINGS.undimSlabs).toBe(MOTION_TIMINGS.lockDim);
    expect(MOTION_TIMINGS.settle).toBe(MOTION_TIMINGS.correctFlash);
    expect(MOTION_TIMINGS.correctFlash).toBe(300);
    expect(MOTION_TIMINGS.ladderStep).toBe(400);
    expect(MOTION_TIMINGS.countUp).toBe(800);
    expect(MOTION_TIMINGS.wrongPick).toBe(250);
    expect(MOTION_TIMINGS.wrongCorrectDelay).toBe(300);
    expect(MOTION_TIMINGS.wrongCorrectLight).toBe(400);
    expect(MOTION_TIMINGS.fiftyFifty).toBe(350);
    expect(MOTION_TIMINGS.resultFade).toBe(300);
    expect(MOTION_TIMINGS.barGrow).toBe(600);
    expect(MOTION_TIMINGS.barStagger).toBe(80);
    expect(MOTION_TIMINGS.finalCount).toBe(1200);
    expect(MOTION_TIMINGS.finalLine).toBe(200);
    expect(finalLineDuration).toBe(MOTION_TIMINGS.resultFade);
  });
});
