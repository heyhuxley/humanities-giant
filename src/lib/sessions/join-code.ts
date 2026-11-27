import { randomInt as cryptoRandomInt } from 'node:crypto';

export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

// Randomness belongs here because this helper is outside the pure game engine; injection makes generation reproducible in tests.
export function generateJoinCode(randomInt: (max: number) => number = cryptoRandomInt): string {
  let code = '';
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (normalized.length !== JOIN_CODE_LENGTH) return null;
  return [...normalized].every((character) => JOIN_CODE_ALPHABET.includes(character)) ? normalized : null;
}
