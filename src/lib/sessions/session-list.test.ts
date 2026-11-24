import { describe, expect, it } from 'vitest';
import { toSessionListItem } from './session-list';

const SESSION_ID = 'a0b1c2d3-e4f5-4678-9012-abcdef012345';
const CREATED_AT = '2026-11-24T09:00:00.000Z';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    code: 'ABCD23',
    public_state: { status: 'waiting' },
    created_at: CREATED_AT,
    ...overrides,
  };
}

describe('toSessionListItem', () => {
  it('maps a valid session row', () => {
    expect(toSessionListItem(makeRow())).toEqual({
      id: SESSION_ID,
      code: 'ABCD23',
      status: 'waiting',
      createdAt: CREATED_AT,
    });
  });

  it('rejects a row without a code', () => {
    expect(toSessionListItem(makeRow({ code: undefined }))).toBeNull();
  });

  it.each([
    ['id', { id: 123 }],
    ['UUID id', { id: 'not-a-uuid' }],
    ['code', { code: 123 }],
    ['created time', { created_at: 123 }],
  ])('rejects a row with an invalid %s', (_label, overrides) => {
    expect(toSessionListItem(makeRow(overrides))).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'not-an-object'],
    ['missing a status', {}],
    ['an invalid status', { status: 'other' }],
  ])('uses unknown status for %s public state', (_label, publicState) => {
    expect(toSessionListItem(makeRow({ public_state: publicState }))).toMatchObject({
      status: 'unknown',
    });
  });

  it('rejects an invalid date', () => {
    expect(toSessionListItem(makeRow({ created_at: 'not-a-date' }))).toBeNull();
  });
});
