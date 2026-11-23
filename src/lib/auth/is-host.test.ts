import { describe, expect, it } from 'vitest';
import { isHostClaims } from './is-host';

describe('isHostClaims', () => {
  it.each([
    { label: 'no claims', claims: null, expected: false },
    { label: 'anonymous user', claims: { sub: 'user-id', is_anonymous: true }, expected: false },
    { label: 'signed in user', claims: { sub: 'user-id', is_anonymous: false }, expected: true },
    { label: 'missing anonymous claim', claims: { sub: 'user-id' }, expected: true },
    { label: 'missing subject', claims: { is_anonymous: false }, expected: false },
  ])('$label', ({ claims, expected }) => {
    expect(isHostClaims(claims)).toBe(expected);
  });
});
