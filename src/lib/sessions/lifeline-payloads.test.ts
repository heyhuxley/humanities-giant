import { describe, expect, it } from 'vitest';
import type { Option } from '../../game/types';
import {
  buildFiftyFifty,
  buildPhoneHint,
  maskRemovedVotes,
  toVoteCounts,
  wrongOptions,
} from './lifeline-payloads';

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe('wrongOptions', () => {
  it.each([
    [0, [1, 2, 3]],
    [1, [0, 2, 3]],
    [2, [0, 1, 3]],
    [3, [0, 1, 2]],
  ] as const)('returns ascending wrong options for %s', (correctIndex, expected) => {
    expect(wrongOptions(correctIndex)).toEqual(expected);
  });

  it.each([4, -1, 1.5, '2', Number.NaN, null])(
    'rejects invalid correct index %s',
    (correctIndex) => {
      expect(() => wrongOptions(correctIndex as never)).toThrow('Invalid correct index.');
    },
  );
});

describe('buildFiftyFifty', () => {
  it.each([0, 1, 2, 3] as const)('keeps each wrong option in turn for correct option %s', (correctIndex) => {
    const keptOptions = [0, 1, 2].map((randomValue) => {
      const calls: number[] = [];
      const removed = buildFiftyFifty(correctIndex, (max) => {
        calls.push(max);
        return randomValue;
      });
      expect(calls).toEqual([3]);
      expect(removed).toEqual([...removed].sort((first, second) => first - second));
      expect(new Set(removed).size).toBe(2);
      expect(removed).not.toContain(correctIndex);
      return wrongOptions(correctIndex).find((option) => !removed.includes(option));
    });

    expect(new Set(keptOptions).size).toBe(3);
  });

  it.each([3, -1, 1.5, Number.NaN])('rejects invalid random result %s', (randomValue) => {
    expect(() => buildFiftyFifty(1, () => randomValue)).toThrow('Invalid random integer.');
  });

  it('rejects an invalid correct option', () => {
    expect(() => buildFiftyFifty(4 as never, () => 0)).toThrow('Invalid correct index.');
  });
});

describe('buildPhoneHint', () => {
  it('rejects a missing input object with a fixed message', () => {
    expect(() => buildPhoneHint(null as never)).toThrow('Invalid phone hint input.');
  });

  it.each([0, 1, 2, 3] as const)('returns correct and wrong hints for option %s', (correctIndex) => {
    for (let roll = 0; roll < 60; roll += 1) {
      expect(buildPhoneHint({
        correctIndex,
        removed: null,
        randomInt: () => roll,
      })).toEqual({ hint: correctIndex, hintIsCorrect: true });
    }

    for (let roll = 60; roll < 100; roll += 1) {
      const result = buildPhoneHint({
        correctIndex,
        removed: null,
        randomInt: (max) => max === 100 ? roll : 0,
      });
      expect(result.hintIsCorrect).toBe(false);
      expect(result.hint).not.toBe(correctIndex);
    }
  });

  it('handles the exact 59 and 60 percent boundaries', () => {
    expect(buildPhoneHint({
      correctIndex: 2,
      removed: null,
      randomInt: (max) => max === 100 ? 59 : 0,
    })).toEqual({ hint: 2, hintIsCorrect: true });
    expect(buildPhoneHint({
      correctIndex: 2,
      removed: null,
      randomInt: (max) => max === 100 ? 60 : 0,
    })).toMatchObject({ hintIsCorrect: false });
  });

  it.each([0, 1, 2, 3] as const)('chooses all wrong options across second rolls for correct option %s', (correctIndex) => {
    const candidates = wrongOptions(correctIndex);
    const hints = candidates.map((candidateIndex, secondRoll) => buildPhoneHint({
      correctIndex,
      removed: null,
      randomInt: (max) => max === 100 ? 60 : secondRoll,
    }).hint);
    expect(hints).toEqual(candidates);
  });

  it.each([0, 1, 2, 3] as const)('honors every valid removed pair for correct option %s', (correctIndex) => {
    const wrong = wrongOptions(correctIndex);
    const removedPairs: [Option, Option][] = [
      [wrong[0], wrong[1]],
      [wrong[0], wrong[2]],
      [wrong[1], wrong[2]],
    ];

    for (const removed of removedPairs) {
      expect(buildPhoneHint({
        correctIndex,
        removed,
        randomInt: (max) => max === 100 ? 0 : 0,
      })).toEqual({ hint: correctIndex, hintIsCorrect: true });
      const result = buildPhoneHint({
        correctIndex,
        removed,
        randomInt: (max) => max === 100 ? 99 : 0,
      });
      expect(result.hintIsCorrect).toBe(false);
      expect(removed).not.toContain(result.hint);
    }
  });

  it('respects correctPercent values of zero and one hundred', () => {
    expect(buildPhoneHint({
      correctIndex: 1,
      removed: null,
      correctPercent: 0,
      randomInt: (max) => max === 100 ? 0 : 0,
    }).hintIsCorrect).toBe(false);
    expect(buildPhoneHint({
      correctIndex: 1,
      removed: null,
      correctPercent: 100,
      randomInt: () => 99,
    })).toEqual({ hint: 1, hintIsCorrect: true });
  });

  it.each([
    ['duplicate options', 1, [0, 0]],
    ['the correct option', 1, [1, 2]],
    ['the wrong length', 1, [0]],
    ['the wrong length', 1, [0, 2, 3]],
    ['a non option', 1, [0, 4]],
  ])('rejects removed options with %s', (_label, correctIndex, removed) => {
    expect(() => buildPhoneHint({
      correctIndex: correctIndex as never,
      removed: removed as never,
      randomInt: () => 0,
    })).toThrow('Invalid removed options.');
  });

  it.each([-1, 101, 59.5])('rejects invalid correctPercent %s', (correctPercent) => {
    expect(() => buildPhoneHint({
      correctIndex: 1,
      removed: null,
      correctPercent,
      randomInt: () => 0,
    })).toThrow('Invalid correct percent.');
  });

  it.each([4, -1, 1.5, '2', Number.NaN, null])(
    'rejects invalid correct index %s',
    (correctIndex) => {
      expect(() => buildPhoneHint({
        correctIndex: correctIndex as never,
        removed: null,
        randomInt: () => 0,
      })).toThrow('Invalid correct index.');
    },
  );

  it('uses the expected random ranges for correct and wrong results', () => {
    const correctCalls: number[] = [];
    buildPhoneHint({
      correctIndex: 1,
      removed: null,
      randomInt: (max) => {
        correctCalls.push(max);
        return 0;
      },
    });
    expect(correctCalls).toEqual([100]);

    const wrongCalls: number[] = [];
    buildPhoneHint({
      correctIndex: 1,
      removed: null,
      randomInt: (max) => {
        wrongCalls.push(max);
        return max === 100 ? 60 : 0;
      },
    });
    expect(wrongCalls).toEqual([100, 3]);
  });

  it.each([100, -1, 1.5, Number.NaN])('rejects an invalid roll %s', (roll) => {
    expect(() => buildPhoneHint({
      correctIndex: 1,
      removed: null,
      randomInt: () => roll,
    })).toThrow('Invalid random integer.');
  });

  it('rejects an out of range second roll', () => {
    expect(() => buildPhoneHint({
      correctIndex: 1,
      removed: null,
      correctPercent: 0,
      randomInt: (max) => max === 100 ? 60 : max,
    })).toThrow('Invalid random integer.');
  });

  it('keeps deterministic seeded samples within expected ranges', () => {
    const random = mulberry32(20261126);
    const randomInt = (max: number) => Math.floor(random() * max);
    let correctHints = 0;
    for (let index = 0; index < 10_000; index += 1) {
      const result = buildPhoneHint({
        correctIndex: (index % 4) as 0 | 1 | 2 | 3,
        removed: null,
        randomInt,
      });
      if (result.hintIsCorrect) correctHints += 1;
    }
    expect(correctHints / 10_000).toBeGreaterThanOrEqual(0.57);
    expect(correctHints / 10_000).toBeLessThanOrEqual(0.63);

    const keptCounts = [0, 0, 0, 0];
    for (let index = 0; index < 10_000; index += 1) {
      const correctIndex = (index % 4) as 0 | 1 | 2 | 3;
      const removed = buildFiftyFifty(correctIndex, randomInt);
      const kept = wrongOptions(correctIndex).find((option) => !removed.includes(option));
      if (kept !== undefined) keptCounts[kept] += 1;
    }
    for (let option = 0; option < 4; option += 1) {
      const rate = keptCounts[option] / (10_000 * 3 / 4);
      expect(rate).toBeGreaterThanOrEqual(0.28);
      expect(rate).toBeLessThanOrEqual(0.38);
    }
  });
});

describe('maskRemovedVotes', () => {
  it('zeroes only removed indexes and returns a fresh array', () => {
    const counts = Object.freeze([1, 2, 3, 4]) as readonly [number, number, number, number];
    expect(maskRemovedVotes(counts, [0, 2])).toEqual([0, 2, 0, 4]);
    expect(counts).toEqual([1, 2, 3, 4]);
  });

  it('returns an equal copy when nothing is removed', () => {
    const counts: [number, number, number, number] = [1, 2, 3, 4];
    const result = maskRemovedVotes(counts, null);
    expect(result).toEqual(counts);
    expect(result).not.toBe(counts);
  });

  it.each([
    ['negative count', [-1, 0, 0, 0]],
    ['fractional count', [0, 1.5, 0, 0]],
    ['NaN count', [0, Number.NaN, 0, 0]],
    ['wrong length', [0, 0, 0]],
  ])('rejects %s', (_label, counts) => {
    expect(() => maskRemovedVotes(counts as never, null)).toThrow('Invalid vote counts.');
  });

  it('rejects malformed removed options', () => {
    expect(() => maskRemovedVotes([1, 2, 3, 4], [1, 1])).toThrow(
      'Invalid removed options.',
    );
  });
});

describe('toVoteCounts', () => {
  it('counts valid option rows', () => {
    expect(toVoteCounts([
      { option_index: 0 },
      { option_index: 1 },
      { option_index: 1 },
      { option_index: 3 },
    ])).toEqual([1, 2, 0, 1]);
  });

  it('returns zeros for empty or non array input', () => {
    expect(toVoteCounts([])).toEqual([0, 0, 0, 0]);
    expect(toVoteCounts(null)).toEqual([0, 0, 0, 0]);
    expect(toVoteCounts('not rows')).toEqual([0, 0, 0, 0]);
  });

  it('ignores malformed option indexes and non object rows', () => {
    expect(toVoteCounts([
      { option_index: 4 },
      { option_index: -1 },
      { option_index: 1.5 },
      { option_index: '2' },
      { option_index: null },
      {},
      null,
      'row',
      3,
      false,
      [0],
    ])).toEqual([0, 0, 0, 0]);
  });

  it('counts a thousand rows correctly', () => {
    const rows = Array.from({ length: 1_000 }, (_value, index) => ({
      option_index: index % 4,
    }));
    expect(toVoteCounts(rows)).toEqual([250, 250, 250, 250]);
  });

  it('does not mutate the input', () => {
    const rows = Object.freeze([
      Object.freeze({ option_index: 0 }),
      Object.freeze({ option_index: 3 }),
    ]);
    expect(toVoteCounts(rows)).toEqual([1, 0, 0, 1]);
    expect(rows).toEqual([{ option_index: 0 }, { option_index: 3 }]);
  });

  it('does not throw when a row accessor is invalid', () => {
    const row = Object.defineProperty({}, 'option_index', {
      get() {
        throw new Error('unexpected value');
      },
    });
    expect(toVoteCounts([{ option_index: 2 }, row])).toEqual([0, 0, 1, 0]);
  });
});
