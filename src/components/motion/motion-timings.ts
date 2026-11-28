export const MOTION_TIMINGS = {
  questionSpotlight: 600,
  numeralFade: 500,
  numeralDelay: 150,
  numeralRise: 12,
  textMax: 900,
  questionSlabDelay: 175,
  slabEnter: 350,
  slabStagger: 120,
  slabRise: 12,
  select: 150,
  selectPulse: 400,
  lockDim: 250,
  undimSlabs: 250,
  lockTighten: 400,
  correctFlash: 300,
  settle: 300,
  ladderStep: 400,
  countUp: 800,
  wrongPick: 250,
  wrongCorrectDelay: 300,
  wrongCorrectLight: 400,
  fiftyFifty: 350,
  resultFade: 300,
  barGrow: 600,
  barStagger: 80,
  finalCount: 1200,
  finalLine: 200,
  reducedFade: 150,
} as const;

export const motionTimings = MOTION_TIMINGS;

export const MOTION_EASINGS = {
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  linear: 'linear',
  ease: 'ease',
} as const;

export const motionEasings = MOTION_EASINGS;

export const questionSpotlight = MOTION_TIMINGS.questionSpotlight;
export const numeralFade = MOTION_TIMINGS.numeralFade;
export const numeralDelay = MOTION_TIMINGS.numeralDelay;
export const textMax = MOTION_TIMINGS.textMax;
export const slabEnter = MOTION_TIMINGS.slabEnter;
export const slabStagger = MOTION_TIMINGS.slabStagger;
export const slabRise = MOTION_TIMINGS.slabRise;
export const select = MOTION_TIMINGS.select;
export const selectPulse = MOTION_TIMINGS.selectPulse;
export const lockDim = MOTION_TIMINGS.lockDim;
export const undimSlabs = MOTION_TIMINGS.undimSlabs;
export const lockTighten = MOTION_TIMINGS.lockTighten;
export const correctFlash = MOTION_TIMINGS.correctFlash;
export const settle = MOTION_TIMINGS.settle;
export const ladderStep = MOTION_TIMINGS.ladderStep;
export const countUp = MOTION_TIMINGS.countUp;
export const wrongPick = MOTION_TIMINGS.wrongPick;
export const wrongCorrectDelay = MOTION_TIMINGS.wrongCorrectDelay;
export const wrongCorrectLight = MOTION_TIMINGS.wrongCorrectLight;
export const fiftyFifty = MOTION_TIMINGS.fiftyFifty;
export const resultFade = MOTION_TIMINGS.resultFade;
export const barGrow = MOTION_TIMINGS.barGrow;
export const barStagger = MOTION_TIMINGS.barStagger;
export const finalCount = MOTION_TIMINGS.finalCount;
export const finalLine = MOTION_TIMINGS.finalLine;
export const finalLineDuration = MOTION_TIMINGS.resultFade;
export const reducedFade = MOTION_TIMINGS.reducedFade;
export const motionNoDelay = 0;

export function totalQuestionEnterMs(): number {
  const numeralEntrance = MOTION_TIMINGS.numeralFade + MOTION_TIMINGS.numeralDelay;
  const questionEntrance = MOTION_TIMINGS.numeralDelay + MOTION_TIMINGS.textMax;
  const fourSlabsEntrance =
    MOTION_TIMINGS.questionSlabDelay +
    MOTION_TIMINGS.slabEnter +
    MOTION_TIMINGS.slabStagger * 3;

  return Math.max(
    MOTION_TIMINGS.questionSpotlight,
    numeralEntrance,
    questionEntrance,
    fourSlabsEntrance,
  );
}
