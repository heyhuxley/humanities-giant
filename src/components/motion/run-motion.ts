import gsap from 'gsap';
import { formatNaira } from '../../lib/sessions/ladder-view';
import { countUpValue } from './count-up';
import type { MotionEvent } from './motion-plan';
import {
  audienceResultSteps,
  fiftyFiftySteps,
  finalResultSteps,
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

const activeBatches = new WeakMap<HTMLElement, () => void>();

function elementsForTarget(
  root: HTMLElement,
  target: MotionStep['target'],
  event: MotionEvent,
): Element[] {
  const selectorByTarget: Record<MotionStep['target'], string> = {
    spotlight: '[data-stage="spotlight"]',
    numeral: '[data-stage="numeral"]',
    question: '[data-stage="question"]',
    slabs: '[data-slab]',
    dimmedSlabs: '[data-slab][data-state="neutral"]',
    correctSlab: '[data-slab][data-state="correct"]',
    wrongSlab: '[data-slab][data-state="wrong"]',
    neutralSlabs: '[data-slab][data-state="neutral"]',
    removedSlabs: '[data-slab][data-state="removed"]',
    resultBlock: event === 'lifeline_phone'
      ? '[data-lifeline="phone"]'
      : '[data-lifeline="audience"]',
    bars: '[data-bar]',
    ladderRow: '[data-ladder-row]',
    amount: '[data-stage="amount"]',
    finalLines: '[data-stage="final-line"]',
    finalAmount: '[data-stage="final-amount"]',
  };

  const elements = Array.from(root.querySelectorAll(selectorByTarget[target]));
  if (target === 'ladderRow') {
    const position = root.getAttribute('data-position');
    return position === null
      ? []
      : elements.filter((element) => element.getAttribute('data-ladder-row') === position);
  }
  return elements;
}

function clearPropsForStep(step: MotionStep): string {
  const properties = Object.keys(step.from ?? {}).map((property) =>
    property === 'opacity' ? 'opacity' : 'transform',
  );
  return [...new Set(properties)].join(',');
}

function stepsForEvent(event: MotionEvent): MotionStep[] | null {
  if (event === 'question_enter') return questionEnterSteps();
  if (event === 'lock_in') return lockInSteps();
  if (event === 'reveal_correct') return revealCorrectSteps();
  if (event === 'reveal_wrong') return revealWrongSteps();
  if (event === 'reveal_timeout') return revealTimeoutSteps();
  if (event === 'ladder_step') return ladderStepSteps();
  if (event === 'fifty_fifty') return fiftyFiftySteps();
  if (event === 'lifeline_phone') return phoneResultSteps();
  if (event === 'lifeline_audience') return audienceResultSteps();
  if (event === 'final_result') return finalResultSteps();
  return null;
}

export function runMotion(events: MotionEvent[], root: HTMLElement): (() => void) | void {
  const batches = events.flatMap((event) => {
    const steps = stepsForEvent(event);
    return steps === null ? [] : [{ event, steps, durationMs: stepsEndMs(steps) }];
  });
  if (batches.length === 0) return;

  activeBatches.get(root)?.();
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;

  const media = gsap.matchMedia(root);
  let removeBatchAttributes = () => {};
  media.add('(prefers-reduced-motion: no-preference)', () => {
    let reverted = false;
    let hasTween = false;
    let countUpRoot: HTMLElement | null = null;
    let countUpOverlay: HTMLElement | null = null;
    let context: gsap.Context | null = null;
    let motionRunningSet = false;
    const clearCountUp = () => {
      countUpRoot?.removeAttribute('data-counting');
      countUpOverlay?.removeAttribute('data-active');
      if (countUpOverlay !== null) countUpOverlay.textContent = '';
      countUpRoot = null;
      countUpOverlay = null;
    };
    const clearBatchAttributes = () => {
      if (motionRunningSet) root.removeAttribute('data-motion-running');
      motionRunningSet = false;
      clearCountUp();
    };
    const revertBatch = () => {
      if (reverted) return;
      reverted = true;
      clearBatchAttributes();
      context?.revert();
    };

    removeBatchAttributes = clearBatchAttributes;
    root.setAttribute('data-motion-running', 'true');
    motionRunningSet = true;
    context = gsap.context(() => {
      const timeline = gsap.timeline({
        onComplete: clearBatchAttributes,
        onInterrupt: revertBatch,
      });
      let batchOffset = 0;
      const hasReveal = batches.some((batch) =>
        batch.event === 'reveal_correct' ||
        batch.event === 'reveal_wrong' ||
        batch.event === 'reveal_timeout',
      );
      const latestOtherEnd = batches
        .filter((batch) => batch.event !== 'final_result')
        .reduce((latest, batch) => Math.max(latest, batch.durationMs), 0);

      for (const batch of batches) {
        if (batch.event === 'final_result' && hasReveal) {
          batchOffset = (latestOtherEnd + 300) / 1000;
        }
        for (const step of batch.steps) {
          const targets = elementsForTarget(root, step.target, batch.event);
          if (step.countUp !== undefined) {
            const amount = targets[0];
            if (!(amount instanceof HTMLElement)) continue;
            const nextText = amount.getAttribute(step.countUp.toAttr);
            if (nextText === null) continue;
            const prevText = step.countUp.fromAttr === undefined
              ? '0'
              : amount.getAttribute(step.countUp.fromAttr);
            if (step.countUp.fromAttr !== undefined && prevText === null) continue;
            const prev = prevText === null
              ? 0
              : Number.parseInt(prevText, 10);
            const next = Number.parseInt(nextText, 10);
            if (!Number.isFinite(prev) || !Number.isFinite(next)) continue;
            if (step.target === 'finalAmount' && next === 0) continue;

            const countUpElement =
              amount.closest<HTMLElement>('[data-countup="root"]') ??
              amount.querySelector<HTMLElement>('[data-countup="root"]');
            const overlay = countUpElement?.querySelector<HTMLElement>('[data-countup-overlay]');
            if (
              countUpElement === null ||
              countUpElement === undefined ||
              overlay === null ||
              overlay === undefined
            ) {
              continue;
            }

            countUpRoot = countUpElement;
            countUpOverlay = overlay;
            countUpRoot.setAttribute('data-counting', 'true');
            countUpOverlay.setAttribute('data-active', 'true');
            countUpOverlay.textContent = formatNaira(prev);
            const progress = { p: 0 };
            hasTween = true;
            timeline.to(
              progress,
              {
                p: 1,
                duration: step.durationMs / 1000,
                ease: step.ease,
                onUpdate: () => {
                  if (countUpOverlay !== null) {
                    countUpOverlay.textContent = formatNaira(
                      countUpValue(prev, next, progress.p),
                    );
                  }
                },
                onComplete: clearCountUp,
                onInterrupt: clearCountUp,
              },
              batchOffset + step.delayMs / 1000,
            );
            continue;
          }
          if (targets.length === 0 || step.from === undefined) continue;

          hasTween = true;
          timeline.from(
            targets,
            {
              ...step.from,
              duration: step.durationMs / 1000,
              ease: step.ease,
              ...(clearPropsForStep(step) === ''
                ? {}
                : { clearProps: clearPropsForStep(step) }),
              ...(step.staggerMs === undefined ? {} : { stagger: step.staggerMs / 1000 }),
            },
            batchOffset + step.delayMs / 1000,
          );
        }
        batchOffset += batch.durationMs / 1000;
      }
    }, root);

    if (!hasTween) {
      reverted = true;
      clearBatchAttributes();
      context.revert();
    }

    return revertBatch;
  });

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    media.revert();
    removeBatchAttributes();
    if (activeBatches.get(root) === cleanup) activeBatches.delete(root);
  };
  activeBatches.set(root, cleanup);
  return cleanup;
}
