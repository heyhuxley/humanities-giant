import { describe, expect, it } from 'vitest';
import {
  audienceBarRows,
  letterFor,
  optionAvailability,
  phoneHintMessage,
} from './lifeline-view';

describe('optionAvailability', () => {
  it('keeps every option available when there are no removed options', () => {
    expect(optionAvailability(null)).toEqual([true, true, true, true]);
  });

  it.each([
    [[0, 1], [false, false, true, true]],
    [[0, 2], [false, true, false, true]],
    [[0, 3], [false, true, true, false]],
    [[1, 2], [true, false, false, true]],
    [[1, 3], [true, false, true, false]],
    [[2, 3], [true, true, false, false]],
  ] as const)('marks removed pair %s unavailable', (removed, expected) => {
    expect(optionAvailability([removed[0], removed[1]])).toEqual(expected);
  });
});

describe('phoneHintMessage', () => {
  it.each([
    [0, 'Your friend thinks the answer is A'],
    [1, 'Your friend thinks the answer is B'],
    [2, 'Your friend thinks the answer is C'],
    [3, 'Your friend thinks the answer is D'],
  ] as const)('formats option %s', (hint, message) => {
    expect(phoneHintMessage(hint)).toBe(message);
  });

  it('returns null when there is no hint', () => {
    expect(phoneHintMessage(null)).toBeNull();
  });
});

describe('audienceBarRows', () => {
  it('returns text and bar values for a normal result', () => {
    const result = audienceBarRows([45, 25, 20, 10], false);
    expect(result).toEqual({
      kind: 'bars',
      rows: [
        { label: 'A', percent: 45, text: 'A: 45%' },
        { label: 'B', percent: 25, text: 'B: 25%' },
        { label: 'C', percent: 20, text: 'C: 20%' },
        { label: 'D', percent: 10, text: 'D: 10%' },
      ],
    });
    if (result?.kind === 'bars') {
      expect(result.rows.map((row) => row.percent)).toEqual([45, 25, 20, 10]);
    }
  });

  it('retains visible zero percentage rows', () => {
    expect(audienceBarRows([0, 30, 0, 70], false)).toMatchObject({
      kind: 'bars',
      rows: [
        { label: 'A', percent: 0, text: 'A: 0%' },
        { label: 'B', percent: 30, text: 'B: 30%' },
        { label: 'C', percent: 0, text: 'C: 0%' },
        { label: 'D', percent: 70, text: 'D: 70%' },
      ],
    });
  });

  it('returns the not enough votes message without percentages', () => {
    expect(audienceBarRows(null, true)).toEqual({
      kind: 'not_enough',
      text: 'Not enough audience votes',
    });
  });

  it('returns null when there is no audience result', () => {
    expect(audienceBarRows(null, false)).toBeNull();
  });
});

describe('letterFor', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [2, 'C'],
    [3, 'D'],
  ] as const)('maps option %s', (option, letter) => {
    expect(letterFor(option)).toBe(letter);
  });
});

it('does not describe any lifeline output as correct, right, or wrong', () => {
  const outputs = [
    optionAvailability([0, 2]),
    phoneHintMessage(1),
    audienceBarRows([45, 25, 20, 10], false),
    audienceBarRows(null, true),
  ];
  expect(JSON.stringify(outputs)).not.toMatch(/correct|right|wrong/i);
});
