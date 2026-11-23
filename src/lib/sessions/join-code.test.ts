import { describe, expect, it, vi } from 'vitest';
import {
  generateJoinCode,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
} from './join-code';

describe('join code helpers', () => {
  it('uses 31 unique characters and excludes ambiguous characters', () => {
    expect(JOIN_CODE_ALPHABET).toHaveLength(31);
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(31);
    for (const character of ['0', 'O', '1', 'I', 'L']) {
      expect(JOIN_CODE_ALPHABET).not.toContain(character);
    }
  });

  it('generates codes of the required length from the alphabet', () => {
    for (let generation = 0; generation < 1000; generation += 1) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect([...code].every((character) => JOIN_CODE_ALPHABET.includes(character))).toBe(true);
    }
  });

  it('uses an injected random integer for each character', () => {
    const randomInt = vi.fn((max: number) => {
      expect(max).toBe(JOIN_CODE_ALPHABET.length);
      return 0;
    });
    expect(generateJoinCode(randomInt)).toBe('AAAAAA');
    expect(randomInt).toHaveBeenCalledTimes(JOIN_CODE_LENGTH);
  });

  it('can select the final character in the alphabet', () => {
    expect(generateJoinCode((max) => max - 1)).toBe('999999');
  });

  it('normalizes valid codes', () => {
    expect(normalizeJoinCode(' ab2-cd3 ')).toBe('AB2CD3');
  });

  it.each([
    ['five characters', 'ABCDE'],
    ['seven characters', 'ABCDEFG'],
    ['forbidden O', 'ABCDO2'],
    ['forbidden 1', 'ABCD12'],
    ['empty string', ''],
    ['null', null],
    ['number', 123456],
    ['object', {}],
  ])('rejects %s', (_label, input) => {
    expect(normalizeJoinCode(input)).toBeNull();
  });
});
