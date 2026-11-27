import { MOTION_EASINGS, MOTION_TIMINGS, motionNoDelay } from './motion-timings';

type MotionFrom = {
  opacity?: number;
  y?: number;
  x?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
};

export type MotionStep = {
  target:
    | 'spotlight'
    | 'numeral'
    | 'question'
    | 'slabs'
    | 'dimmedSlabs'
    | 'correctSlab'
    | 'wrongSlab'
    | 'neutralSlabs'
    | 'removedSlabs'
    | 'resultBlock'
    | 'bars'
    | 'ladderRow'
    | 'amount';
  from?: MotionFrom;
  durationMs: number;
  delayMs: number;
  staggerMs?: number;
  ease: string;
  countUp?: {
    fromAttr: string;
    toAttr: string;
  };
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

export function revealCorrectSteps(): MotionStep[] {
  return [
    {
      target: 'neutralSlabs',
      from: { opacity: 0.4 },
      durationMs: MOTION_TIMINGS.undimSlabs,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'correctSlab',
      from: { scale: 1.05, opacity: 0.6 },
      durationMs: MOTION_TIMINGS.correctFlash,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function revealWrongSteps(): MotionStep[] {
  return [
    {
      target: 'neutralSlabs',
      from: { opacity: 0.4 },
      durationMs: MOTION_TIMINGS.undimSlabs,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'wrongSlab',
      from: { opacity: 0.6 },
      durationMs: MOTION_TIMINGS.wrongPick,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'correctSlab',
      from: { opacity: 0.35 },
      durationMs: MOTION_TIMINGS.wrongCorrectLight,
      delayMs: MOTION_TIMINGS.wrongCorrectDelay,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function revealTimeoutSteps(): MotionStep[] {
  return [
    {
      target: 'neutralSlabs',
      from: { opacity: 0.4 },
      durationMs: MOTION_TIMINGS.undimSlabs,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'correctSlab',
      from: { opacity: 0.35 },
      durationMs: MOTION_TIMINGS.wrongCorrectLight,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function ladderStepSteps(): MotionStep[] {
  return [
    {
      target: 'ladderRow',
      from: { y: 8, opacity: 0.6 },
      durationMs: MOTION_TIMINGS.ladderStep,
      delayMs: MOTION_TIMINGS.correctFlash,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'amount',
      durationMs: MOTION_TIMINGS.countUp,
      delayMs: MOTION_TIMINGS.correctFlash,
      ease: MOTION_EASINGS.easeOut,
      countUp: {
        fromAttr: 'data-amount-prev',
        toAttr: 'data-amount',
      },
    },
  ];
}

export function fiftyFiftySteps(): MotionStep[] {
  return [
    {
      target: 'removedSlabs',
      from: { y: -12 },
      durationMs: MOTION_TIMINGS.fiftyFifty,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function phoneResultSteps(): MotionStep[] {
  return [
    {
      target: 'resultBlock',
      from: { opacity: 0 },
      durationMs: MOTION_TIMINGS.resultFade,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
  ];
}

export function audienceResultSteps(): MotionStep[] {
  return [
    {
      target: 'resultBlock',
      from: { opacity: 0 },
      durationMs: MOTION_TIMINGS.resultFade,
      delayMs: motionNoDelay,
      ease: MOTION_EASINGS.easeOut,
    },
    {
      target: 'bars',
      from: { scaleX: 0 },
      durationMs: MOTION_TIMINGS.barGrow,
      delayMs: motionNoDelay,
      staggerMs: MOTION_TIMINGS.barStagger,
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
