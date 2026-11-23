import { describe, expect, it } from 'vitest';
import { parseJoinForm } from './parse-join-form';

function makeForm(code?: string | Blob, displayName?: string | Blob): FormData {
  const formData = new FormData();
  if (code !== undefined) formData.append('code', code);
  if (displayName !== undefined) formData.append('displayName', displayName);
  return formData;
}

describe('parseJoinForm', () => {
  it('accepts a valid code and display name', () => {
    expect(parseJoinForm(makeForm('AB2345', 'Ade Bola'))).toEqual({
      ok: true,
      code: 'AB2345',
      displayName: 'Ade Bola',
    });
  });

  it('normalizes a lowercase code with spaces and a hyphen', () => {
    expect(parseJoinForm(makeForm(' ab2-cd3 ', '  Ade   Bola '))).toEqual({
      ok: true,
      code: 'AB2CD3',
      displayName: 'Ade Bola',
    });
  });

  it.each(['AB234', 'ABO345'])('rejects short codes and codes with forbidden characters: %s', (code) => {
    expect(parseJoinForm(makeForm(code, 'Ade'))).toEqual({
      ok: false,
      errors: { code: 'Enter a valid six character join code.' },
    });
  });

  it.each([
    ['', 'Use 1 to 30 characters.'],
    ['   \t\n ', 'Use 1 to 30 characters.'],
    ['A'.repeat(31), 'Use 1 to 30 characters.'],
    ['Ade\u0000Bola', 'Remove unsupported control characters.'],
  ])('rejects an invalid display name: %j', (displayName, expectedError) => {
    expect(parseJoinForm(makeForm('AB2345', displayName))).toEqual({
      ok: false,
      errors: { displayName: expectedError },
    });
  });

  it('reports both fields when both are invalid', () => {
    expect(parseJoinForm(makeForm('ABO', '   '))).toEqual({
      ok: false,
      errors: {
        code: 'Enter a valid six character join code.',
        displayName: 'Use 1 to 30 characters.',
      },
    });
  });

  it('rejects missing fields', () => {
    expect(parseJoinForm(makeForm())).toEqual({
      ok: false,
      errors: {
        code: 'Enter a valid six character join code.',
        displayName: 'Enter a display name.',
      },
    });
  });

  it('rejects non string field values', () => {
    expect(parseJoinForm(makeForm(new Blob(['AB2345']), new Blob(['Ade Bola'])))).toEqual({
      ok: false,
      errors: {
        code: 'Enter a valid six character join code.',
        displayName: 'Enter a display name.',
      },
    });
  });
});
