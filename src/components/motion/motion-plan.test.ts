import { describe, expect, it } from 'vitest';
import {
  planMotion,
  recordSnapshot,
  snapshotsEqual,
  type MotionSnapshot,
  type SlabView,
} from './motion-plan';

function snapshot(
  position: number,
  status: MotionSnapshot['status'],
  slabs: [SlabView, SlabView, SlabView, SlabView] = ['neutral', 'neutral', 'neutral', 'neutral'],
  lifelineResults: MotionSnapshot['lifelineResults'] = {
    fiftyFifty: false,
    phone: false,
    audience: false,
  },
): MotionSnapshot {
  return { position, status, slabs, lifelineResults };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

describe('snapshotsEqual', () => {
  it('compares every snapshot field deeply', () => {
    const first = snapshot(3, 'locked', ['neutral', 'locked', 'neutral', 'neutral']);
    const second = snapshot(3, 'locked', ['neutral', 'locked', 'neutral', 'neutral']);

    expect(snapshotsEqual(first, second)).toBe(true);
    expect(snapshotsEqual(first, snapshot(4, 'locked'))).toBe(false);
  });
});

describe('planMotion', () => {
  it('fires no events on first load or identical deep equal snapshots', () => {
    const initial = snapshot(1, 'question_active');
    expect(planMotion(null, initial)).toEqual([]);
    expect(planMotion(initial, snapshot(
      1,
      'question_active',
      ['neutral', 'neutral', 'neutral', 'neutral'],
    ))).toEqual([]);
  });

  it('compares deep equal arrays and lifeline objects by value', () => {
    const prev = snapshot(2, 'locked', ['locked', 'neutral', 'neutral', 'neutral']);
    const next = snapshot(2, 'locked', ['locked', 'neutral', 'neutral', 'neutral']);
    expect(prev.slabs).not.toBe(next.slabs);
    expect(planMotion(prev, next)).toEqual([]);
  });

  it('returns no events for unknown, backwards, and skipped status moves', () => {
    expect(planMotion(snapshot(2, 'question_active'), snapshot(2, 'unknown'))).toEqual([]);
    expect(planMotion(snapshot(3, 'locked'), snapshot(2, 'locked'))).toEqual([]);
    expect(planMotion(snapshot(2, 'locked'), snapshot(2, 'waiting'))).toEqual([]);
    expect(planMotion(snapshot(2, 'waiting'), snapshot(2, 'locked'))).toEqual([]);
    expect(planMotion(snapshot(2, 'locked'), snapshot(2, 'question_active'))).toEqual([]);
  });

  it('rejects jumps of two or three positions', () => {
    expect(planMotion(snapshot(1, 'waiting'), snapshot(3, 'question_active'))).toEqual([]);
    expect(planMotion(snapshot(1, 'waiting'), snapshot(4, 'question_active'))).toEqual([]);
  });

  it('allows waiting to question active at position one', () => {
    expect(planMotion(snapshot(0, 'waiting'), snapshot(1, 'question_active'))).toEqual(['question_enter']);
  });

  it('allows question_enter on every legal position step', () => {
    expect(planMotion(snapshot(4, 'revealed'), snapshot(5, 'question_active'))).toEqual(['question_enter']);
  });

  it('handles question_active directly to revealed with and without a timeout reveal', () => {
    expect(planMotion(
      snapshot(2, 'question_active'),
      snapshot(2, 'revealed', ['correct', 'neutral', 'neutral', 'neutral']),
    )).toEqual(['reveal_timeout']);
    expect(planMotion(
      snapshot(2, 'question_active'),
      snapshot(2, 'revealed', ['wrong', 'correct', 'neutral', 'neutral']),
    )).toEqual(['reveal_wrong']);
  });

  it('handles question_active directly to finished as a final result without a reveal when no correct slab exists', () => {
    expect(planMotion(
      snapshot(2, 'question_active'),
      snapshot(2, 'finished', ['neutral', 'neutral', 'neutral', 'neutral']),
    )).toEqual(['final_result']);
  });

  it.each([
    {
      name: 'wrong reveal',
      prev: snapshot(4, 'locked', ['neutral', 'locked', 'neutral', 'neutral']),
      next: snapshot(4, 'revealed', ['neutral', 'wrong', 'correct', 'neutral']),
      expected: ['reveal_wrong'],
    },
    {
      name: 'correct reveal',
      prev: snapshot(4, 'locked', ['neutral', 'locked', 'neutral', 'neutral']),
      next: snapshot(4, 'revealed', ['neutral', 'correct', 'neutral', 'neutral']),
      expected: ['reveal_correct', 'ladder_step'],
    },
    {
      name: 'timeout reveal',
      prev: snapshot(4, 'question_active'),
      next: snapshot(4, 'revealed', ['correct', 'neutral', 'neutral', 'neutral']),
      expected: ['reveal_timeout'],
    },
  ])('plans $name reveal variants', ({ prev, next, expected }) => {
    expect(planMotion(prev, next)).toEqual(expected);
  });

  it('adds ladder_step only after reveal_correct and only while status is revealed', () => {
    const prev = snapshot(4, 'locked', ['locked', 'neutral', 'neutral', 'neutral']);
    expect(planMotion(prev, snapshot(4, 'revealed', ['correct', 'neutral', 'neutral', 'neutral']))).toEqual([
      'reveal_correct',
      'ladder_step',
    ]);
    expect(planMotion(prev, snapshot(4, 'finished', ['correct', 'neutral', 'neutral', 'neutral']))).toEqual([
      'reveal_correct',
      'final_result',
    ]);
  });

  it('adds final_result after a wrong reveal', () => {
    const prev = snapshot(6, 'locked', ['neutral', 'locked', 'neutral', 'neutral']);
    expect(planMotion(prev, snapshot(6, 'finished', ['neutral', 'wrong', 'correct', 'neutral']))).toEqual([
      'reveal_wrong',
      'final_result',
    ]);
  });

  it('uses no ladder_step for a win at position 15', () => {
    const prev = snapshot(15, 'locked', ['neutral', 'locked', 'neutral', 'neutral']);
    expect(planMotion(prev, snapshot(15, 'finished', ['neutral', 'correct', 'neutral', 'neutral']))).toEqual([
      'reveal_correct',
      'final_result',
    ]);
  });

  it('plans final_result for a revealed to finished walk away', () => {
    expect(planMotion(
      snapshot(7, 'revealed', ['neutral', 'correct', 'neutral', 'neutral']),
      snapshot(7, 'finished', ['neutral', 'correct', 'neutral', 'neutral']),
    )).toEqual(['final_result']);
  });

  it('plans lock_in for question_active to locked', () => {
    expect(planMotion(
      snapshot(3, 'question_active'),
      snapshot(3, 'locked', ['neutral', 'locked', 'neutral', 'neutral']),
    )).toEqual(['lock_in']);
  });

  it('adds lifeline events after status events', () => {
    expect(planMotion(
      snapshot(3, 'question_active'),
      snapshot(3, 'locked', ['neutral', 'locked', 'neutral', 'neutral'], {
        fiftyFifty: true,
        phone: true,
        audience: false,
      }),
    )).toEqual([
      'lock_in',
      'fifty_fifty',
      'lifeline_phone',
    ]);
  });

  it('preserves lifeline order for all three in one change', () => {
    expect(planMotion(
      snapshot(5, 'question_active'),
      snapshot(5, 'question_active', ['neutral', 'neutral', 'neutral', 'neutral'], {
        fiftyFifty: true,
        phone: true,
        audience: true,
      }),
    )).toEqual([
      'fifty_fifty',
      'lifeline_phone',
      'lifeline_audience',
    ]);
  });

  it('does not evaluate lifeline flags on question_enter', () => {
    expect(planMotion(
      snapshot(4, 'revealed'),
      snapshot(5, 'question_active', ['neutral', 'neutral', 'neutral', 'neutral'], {
        fiftyFifty: true,
        phone: true,
        audience: true,
      }),
    )).toEqual(['question_enter']);
  });

  it('does not emit lifelines when a flag goes true to false', () => {
    expect(planMotion(
      snapshot(5, 'locked', ['neutral', 'locked', 'neutral', 'neutral'], {
        fiftyFifty: true,
        phone: true,
        audience: true,
      }),
      snapshot(5, 'locked', ['neutral', 'locked', 'neutral', 'neutral']),
    )).toEqual([]);
  });

  it('does not mutate frozen inputs and returns a new array', () => {
    const prev = deepFreeze(snapshot(8, 'question_active'));
    const next = deepFreeze(snapshot(8, 'locked', ['neutral', 'locked', 'neutral', 'neutral']));
    const first = planMotion(prev, next);
    const second = planMotion(prev, next);
    expect(first).toEqual(['lock_in']);
    expect(first).not.toBe(second);
  });

  it('returns no events twice after recording a strict mode duplicate', () => {
    const snapshotValue = deepFreeze(snapshot(9, 'locked', ['neutral', 'locked', 'neutral', 'neutral']));
    const first = recordSnapshot(null, snapshotValue);
    const second = recordSnapshot(first.nextPrev, snapshotValue);
    expect(first.events).toEqual([]);
    expect(second.events).toEqual([]);
  });
});
