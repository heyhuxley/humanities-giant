export type NormalizeDisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const DISALLOWED_CONTROL = /\p{Cc}/u;
const DISALLOWED_INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/u;
const ALLOWED_WHITESPACE_CONTROLS = new Set(['\t', '\n', '\r']);

export function normalizeDisplayName(input: unknown): NormalizeDisplayNameResult {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Enter a display name.' };
  }

  for (const character of input) {
    if (DISALLOWED_INVISIBLE.test(character)) {
      return { ok: false, error: 'Remove hidden formatting characters.' };
    }
    if (DISALLOWED_CONTROL.test(character) && !ALLOWED_WHITESPACE_CONTROLS.has(character)) {
      return { ok: false, error: 'Remove unsupported control characters.' };
    }
  }

  const value = input.trim().replace(/\s+/gu, ' ');
  const length = Array.from(value).length;
  if (length < 1 || length > 30) {
    return { ok: false, error: 'Use 1 to 30 characters.' };
  }

  return { ok: true, value };
}
