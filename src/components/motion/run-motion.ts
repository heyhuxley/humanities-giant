import gsap from 'gsap';
import type { MotionEvent } from './motion-plan';
import {
  lockInSteps,
  questionEnterSteps,
  stepsEndMs,
  type MotionStep,
} from './motion-steps';

const activeBatches = new WeakMap<HTMLElement, () => void>();

function elementsForTarget(root: HTMLElement, target: MotionStep['target']): Element[] {
  const selectorByTarget: Record<MotionStep['target'], string> = {
    spotlight: '[data-stage="spotlight"]',
    numeral: '[data-stage="numeral"]',
    question: '[data-stage="question"]',
    slabs: '[data-slab]',
    dimmedSlabs: '[data-slab][data-state="neutral"]',
  };

  return Array.from(root.querySelectorAll(selectorByTarget[target]));
}

function clearPropsForStep(step: MotionStep): string {
  const properties = Object.keys(step.from).map((property) =>
    property === 'opacity' ? 'opacity' : 'transform',
  );
  return [...new Set(properties)].join(',');
}

function stepsForEvent(event: MotionEvent): MotionStep[] | null {
  if (event === 'question_enter') return questionEnterSteps();
  if (event === 'lock_in') return lockInSteps();
  // Reveal and later show moments are implemented in the next slice.
  return null;
}

export function runMotion(events: MotionEvent[], root: HTMLElement): (() => void) | void {
  const batches = events.flatMap((event) => {
    const steps = stepsForEvent(event);
    return steps === null ? [] : [{ steps, durationMs: stepsEndMs(steps) }];
  });
  if (batches.length === 0) return;

  activeBatches.get(root)?.();
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;

  const media = gsap.matchMedia(root);
  media.add('(prefers-reduced-motion: no-preference)', () => {
    const context = gsap.context(() => {
      const timeline = gsap.timeline();
      let batchOffset = 0;

      for (const batch of batches) {
        for (const step of batch.steps) {
          const targets = elementsForTarget(root, step.target);
          if (targets.length === 0) continue;

          timeline.from(
            targets,
            {
              ...step.from,
              duration: step.durationMs / 1000,
              ease: step.ease,
              clearProps: clearPropsForStep(step),
              ...(step.staggerMs === undefined ? {} : { stagger: step.staggerMs / 1000 }),
            },
            batchOffset + step.delayMs / 1000,
          );
        }
        batchOffset += batch.durationMs / 1000;
      }
    }, root);

    return () => context.revert();
  });

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    media.revert();
    if (activeBatches.get(root) === cleanup) activeBatches.delete(root);
  };
  activeBatches.set(root, cleanup);
  return cleanup;
}
