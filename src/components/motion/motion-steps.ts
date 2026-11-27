import { MOTION_EASINGS, MOTION_TIMINGS, motionNoDelay } from './motion-timings';

export type MotionStep = {
  target: 'spotlight' | 'numeral' | 'question' | 'slabs' | 'dimmedSlabs';
  from: {
    opacity?: number;
    y?: number;
    x?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
  };
  durationMs: number;
  delayMs: number;
  staggerMs?: number;
  ease: string;
};

export function questionEnterSteps(): MotionStep[] {
  return [
    {
      target: 'spotlight',
      from: { opacity: 0 },
      durationMs: MOTION_TIMINGS.questionSpotlight,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'numeral',
      from: { opacity: 0, y: MOTION_TIMINGS.numeralRise },
      durationMs: MOTION_TIMINGS.numeralFade,
      delayMs: MOTION_TIMINGS.numeralDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'question',
      from: { opacity: 0, y: 8 },
      durationMs: MOTION_TIMINGS.textMax,
      delayMs: MOTION_TIMINGS.numeralDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'slabs',
      from: { opacity: 0, y: MOTION_TIMINGS.slabRise },
      durationMs: MOTION_TIMINGS.slabEnter,
      delayMs: MOTION_TIMINGS.questionSlabDelay,
      staggerMs: MOTION_TIMINGS.slabStagger,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function lockInSteps(): MotionStep[] {
  return [
    {
      target: 'dimmedSlabs',
      from: { opacity: 1 },
      durationMs: MOTION_TIMINGS.lockDim,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'spotlight',
      from: { scale: 1 },
      durationMs: MOTION_TIMINGS.lockTighten,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function stepsEndMs(steps: MotionStep[]): number {
  return steps.reduce(
    (latestEnd, step) => Math.max(
      latestEnd,
      step.delayMs + step.durationMs + (step.staggerMs ?? 0) * 3,
    ),
    0,
  );
}
