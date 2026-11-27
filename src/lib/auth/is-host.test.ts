import { describe, expect, it } from 'vitest';
import { isAnonymousClaims, isHostClaims } from './is-host';

describe('isHostClaims', () => {
  it.each([
    { label: 'no claims', claims: null, expected: false },
    {
      label: 'anonymous user with host role',
      claims: { sub: 'user-id', is_anonymous: true, app_metadata: { role: 'host' } },
      expected: false,
    },
    {
      label: 'signed in user with host role',
      claims: { sub: 'user-id', is_anonymous: false, app_metadata: { role: 'host' } },
      expected: true,
    },
    {
      label: 'missing anonymous claim with host role',
      claims: { sub: 'user-id', app_metadata: { role: 'host' } },
      expected: true,
    },
    {
      label: 'missing app metadata',
      claims: { sub: 'user-id', is_anonymous: false },
      expected: false,
    },
    {
      label: 'admin role',
      claims: { sub: 'user-id', app_metadata: { role: 'admin' } },
      expected: false,
    },
    {
      label: 'other string role',
      claims: { sub: 'user-id', app_metadata: { role: 'player' } },
      expected: false,
    },
    {
      label: 'non-string role',
      claims: { sub: 'user-id', app_metadata: { role: 1 } },
      expected: false,
    },
    {
      label: 'missing subject',
      claims: { is_anonymous: false, app_metadata: { role: 'host' } },
      expected: false,
    },
  ])('$label', ({ claims, expected }) => {
    expect(isHostClaims(claims)).toBe(expected);
  });
});

describe('isAnonymousClaims', () => {
  it.each([
    { label: 'no claims', claims: null, expected: false },
    { label: 'anonymous claim true', claims: { is_anonymous: true }, expected: true },
    { label: 'anonymous claim false', claims: { is_anonymous: false }, expected: false },
    { label: 'missing anonymous claim', claims: {}, expected: false },
    { label: 'non-boolean anonymous claim', claims: { is_anonymous: 'true' }, expected: false },
  ])('$label', ({ claims, expected }) => {
    expect(isAnonymousClaims(claims)).toBe(expected);
  });
});
