import { describe, expect, it } from 'vitest';
import {
  MOTION_EASINGS,
  MOTION_TIMINGS,
  motionNoDelay,
  totalQuestionEnterMs,
} from './motion-timings';
import {
  audienceResultSteps,
  fiftyFiftySteps,
  ladderStepSteps,
  lockInSteps,
  phoneResultSteps,
  questionEnterSteps,
  revealCorrectSteps,
  revealTimeoutSteps,
  revealWrongSteps,
  stepsEndMs,
  type MotionStep,
} from './motion-steps';

const allowedTargets = new Set([
  'spotlight',
  'numeral',
  'question',
  'slabs',
  'dimmedSlabs',
  'correctSlab',
  'wrongSlab',
  'neutralSlabs',
  'removedSlabs',
  'resultBlock',
  'bars',
  'ladderRow',
  'amount',
]);
const allowedFromProperties = new Set(['opacity', 'y', 'x', 'scale', 'scaleX', 'scaleY']);
const allowedStepProperties = new Set([
  'target',
  'from',
  'durationMs',
  'delayMs',
  'staggerMs',
  'ease',
  'countUp',
]);
const timingValues = [...Object.values(MOTION_TIMINGS), motionNoDelay];

function expectStepsUseAllowedValues(steps: MotionStep[]) {
  for (const step of steps) {
    expect(allowedTargets.has(step.target)).toBe(true);
    expect(Object.keys(step).every((property) => allowedStepProperties.has(property))).toBe(true);
    expect(Object.keys(step.from ?? {}).every((property) => allowedFromProperties.has(property))).toBe(true);
    expect(timingValues).toContain(step.durationMs);
    expect(timingValues).toContain(step.delayMs);
    if (step.staggerMs !== undefined) expect(timingValues).toContain(step.staggerMs);
    expect(step.ease).toBe(MOTION_EASINGS.easeOut);
    if (step.countUp !== undefined) {
      expect(Object.keys(step.countUp)).toEqual(['fromAttr', 'toAttr']);
    }
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
    expect(steps[2].from?.y).toBe(8);
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

  it.each([
    ['correct reveal', revealCorrectSteps],
    ['wrong reveal', revealWrongSteps],
    ['timeout reveal', revealTimeoutSteps],
    ['ladder step', ladderStepSteps],
    ['50:50', fiftyFiftySteps],
    ['phone result', phoneResultSteps],
    ['audience result', audienceResultSteps],
  ])('keeps %s within the authored motion budget', (_name, createSteps) => {
    const steps = createSteps();
    expectStepsUseAllowedValues(steps);
    expect(stepsEndMs(steps)).toBeLessThanOrEqual(2000);
  });

  it('keeps the correct reveal and ladder step sequence within two seconds', () => {
    expect(stepsEndMs([...revealCorrectSteps(), ...ladderStepSteps()]))
      .toBeLessThanOrEqual(2000);
  });

  it('starts count-up no earlier than the correct flash', () => {
    const amountStep = ladderStepSteps().find((step) => step.target === 'amount');
    expect(amountStep?.delayMs).toBeGreaterThanOrEqual(MOTION_TIMINGS.correctFlash);
  });

  it('assigns the reveal and lifeline steps to their intended targets and values', () => {
    expect(revealCorrectSteps().map((step) => [step.target, step.from])).toEqual([
      ['neutralSlabs', { opacity: 0.4 }],
      ['correctSlab', { scale: 1.05, opacity: 0.6 }],
    ]);
    expect(revealWrongSteps().map((step) => step.target)).toEqual([
      'neutralSlabs',
      'wrongSlab',
      'correctSlab',
    ]);
    expect(revealTimeoutSteps().map((step) => step.target)).toEqual([
      'neutralSlabs',
      'correctSlab',
    ]);
    expect(fiftyFiftySteps()[0]?.from).toEqual({ y: -12 });
    expect(phoneResultSteps()[0]?.from).toEqual({ opacity: 0 });
    expect(audienceResultSteps()[1]?.from).toEqual({ scaleX: 0 });
  });

  it('returns fresh objects for every new reveal and result step list', () => {
    for (const createSteps of [
      revealCorrectSteps,
      revealWrongSteps,
      revealTimeoutSteps,
      ladderStepSteps,
      fiftyFiftySteps,
      phoneResultSteps,
      audienceResultSteps,
    ]) {
      const first = createSteps();
      const second = createSteps();
      expect(first).not.toBe(second);
      expect(first[0]).not.toBe(second[0]);
      if (first[0]?.from !== undefined && second[0]?.from !== undefined) {
        expect(first[0].from).not.toBe(second[0].from);
      }
      if (first[1]?.countUp !== undefined && second[1]?.countUp !== undefined) {
        expect(first[1].countUp).not.toBe(second[1].countUp);
      }
    }
  });
});
