import { describe, expect, it } from 'vitest';
import {
  MOTION_EASINGS,
  MOTION_TIMINGS,
  motionNoDelay,
  totalQuestionEnterMs,
} from './motion-timings';
import { lockInSteps, questionEnterSteps, stepsEndMs, type MotionStep } from './motion-steps';

const allowedTargets = new Set(['spotlight', 'numeral', 'question', 'slabs', 'dimmedSlabs']);
const allowedFromProperties = new Set(['opacity', 'y', 'x', 'scale', 'scaleX', 'scaleY']);
const allowedStepProperties = new Set([
  'target',
  'from',
  'durationMs',
  'delayMs',
  'staggerMs',
  'ease',
]);
const timingValues = [...Object.values(MOTION_TIMINGS), motionNoDelay];

function expectStepsUseAllowedValues(steps: MotionStep[]) {
  for (const step of steps) {
    expect(allowedTargets.has(step.target)).toBe(true);
    expect(Object.keys(step).every((property) => allowedStepProperties.has(property))).toBe(true);
    expect(Object.keys(step.from).every((property) => allowedFromProperties.has(property))).toBe(true);
    expect(timingValues).toContain(step.durationMs);
    expect(timingValues).toContain(step.delayMs);
    if (step.staggerMs !== undefined) expect(timingValues).toContain(step.staggerMs);
    expect(step.ease).toBe(MOTION_EASINGS.easeOut);
  }
}

describe('motion steps', () => {
  it('keeps question entrance properties and timings within its authored budget', () => {
    const steps = questionEnterSteps();
    expectStepsUseAllowedValues(steps);
    expect(steps.map((step) => step.target)).toEqual([
      'spotlight',
      'numeral',
      'question',
      'slabs',
    ]);
    expect(steps[2].delayMs).toBe(MOTION_TIMINGS.numeralDelay);
    expect(steps[2].from.y).toBe(8);
    expect(steps[3].delayMs).toBeGreaterThan(steps[2].delayMs);
    expect(steps[3].staggerMs).toBe(MOTION_TIMINGS.slabStagger);
    expect(stepsEndMs(steps)).toBeLessThanOrEqual(totalQuestionEnterMs());
    expect(stepsEndMs(steps)).toBeLessThanOrEqual(2500);
  });

  it('stagger enters slabs in A to D order', () => {
    const steps = questionEnterSteps();
    const slabStep = steps.find((step) => step.target === 'slabs');

    expect(slabStep?.staggerMs).toBe(MOTION_TIMINGS.slabStagger);
    expect(slabStep).toBeDefined();
    if (slabStep === undefined) throw new Error('Slab entrance step is missing');
    expect(stepsEndMs([slabStep])).toBe(
      slabStep.delayMs + slabStep.durationMs + MOTION_TIMINGS.slabStagger * 3,
    );
  });

  it('keeps lock in motion within 400 milliseconds', () => {
    const steps = lockInSteps();
    expectStepsUseAllowedValues(steps);
    expect(steps.map((step) => step.target)).toEqual(['dimmedSlabs', 'spotlight']);
    expect(stepsEndMs(steps)).toBeLessThanOrEqual(400);
  });

  it('returns independent step arrays and objects without mutating stepsEndMs inputs', () => {
    const first = questionEnterSteps();
    const second = questionEnterSteps();
    const before = JSON.stringify(first);

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].from).not.toBe(second[0].from);
    stepsEndMs(first);
    expect(JSON.stringify(first)).toBe(before);
  });
});
