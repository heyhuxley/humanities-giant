import { describe, expect, it } from 'vitest';
import { normalizeDisplayName } from './display-name';

describe('normalizeDisplayName', () => {
  it('accepts a valid display name', () => {
    expect(normalizeDisplayName('Ade Bola')).toEqual({ ok: true, value: 'Ade Bola' });
  });

  it('trims and collapses surrounding and internal whitespace', () => {
    expect(normalizeDisplayName('  Ade   Bola ')).toEqual({ ok: true, value: 'Ade Bola' });
  });

  it.each(['', '   \t\n  '])('rejects an empty or whitespace only name: %j', (name) => {
    expect(normalizeDisplayName(name).ok).toBe(false);
  });

  it('accepts exactly 30 characters and rejects 31', () => {
    expect(normalizeDisplayName('a'.repeat(30))).toEqual({ ok: true, value: 'a'.repeat(30) });
    expect(normalizeDisplayName('a'.repeat(31)).ok).toBe(false);
  });

  it('counts emoji and non Latin names by Unicode code points', () => {
    expect(normalizeDisplayName('😀'.repeat(30))).toEqual({ ok: true, value: '😀'.repeat(30) });
    expect(normalizeDisplayName('😀'.repeat(31)).ok).toBe(false);
    expect(normalizeDisplayName('字'.repeat(30))).toEqual({ ok: true, value: '字'.repeat(30) });
    expect(normalizeDisplayName('字'.repeat(31)).ok).toBe(false);
  });

  it('normalizes tabs and newlines to spaces', () => {
    expect(normalizeDisplayName('Ade\tBola\nAyo')).toEqual({ ok: true, value: 'Ade Bola Ayo' });
  });

  it.each(['\u0000', '\u007f'])('rejects other control characters: %j', (control) => {
    expect(normalizeDisplayName(`Ade${control}Bola`).ok).toBe(false);
  });

  it.each(['\u200b', '\u202e'])('rejects zero width and bidi override characters: %j', (character) => {
    expect(normalizeDisplayName(`Ade${character}Bola`).ok).toBe(false);
  });

  it.each([null, 42, { name: 'Ade Bola' }])('rejects non string input: %j', (input) => {
    expect(normalizeDisplayName(input).ok).toBe(false);
  });

  it('does not mutate its input', () => {
    const input = Object.freeze({ displayName: '  Ade   Bola ' });
    expect(normalizeDisplayName(input).ok).toBe(false);
    expect(input).toEqual({ displayName: '  Ade   Bola ' });
  });
});
