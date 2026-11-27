import { describe, expect, it } from 'vitest';
import { parseQuestionIds } from './parse-question-ids';

function questionIds(count = 15): string[] {
  return Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
}

function formWith(value: string): FormData {
  const formData = new FormData();
  formData.set('questionIds', value);
  return formData;
}

describe('parseQuestionIds', () => {
  it('accepts fifteen UUIDs, lowercases them, and keeps their order', () => {
    const ids = questionIds();
    ids[0] = ids[0].toUpperCase();
    const result = parseQuestionIds(formWith(ids.join(',')));
    expect(result).toEqual({ ok: true, ids: ids.map((id) => id.toLowerCase()) });
  });

  it.each([14, 16])('rejects %i ids', (count) => {
    expect(parseQuestionIds(formWith(questionIds(count).join(','))).ok).toBe(false);
  });

  it('rejects duplicate IDs', () => {
    const ids = questionIds();
    ids[1] = ids[0];
    expect(parseQuestionIds(formWith(ids.join(',')))).toMatchObject({ ok: false });
  });

  it('rejects duplicate IDs that differ only by case', () => {
    const ids = questionIds();
    ids[1] = ids[0].toUpperCase();
    expect(parseQuestionIds(formWith(ids.join(',')))).toMatchObject({ ok: false });
  });

  it('rejects an invalid UUID', () => {
    const ids = questionIds();
    ids[4] = 'not-a-uuid';
    expect(parseQuestionIds(formWith(ids.join(',')))).toMatchObject({ ok: false });
  });

  it('rejects an empty string', () => {
    expect(parseQuestionIds(formWith(''))).toMatchObject({ ok: false });
  });

  it('rejects a missing field', () => {
    expect(parseQuestionIds(new FormData())).toMatchObject({ ok: false });
  });

  it('rejects a non-string field value', () => {
    const formData = new FormData();
    formData.set('questionIds', new Blob(['file value']), 'ids.txt');
    expect(parseQuestionIds(formData)).toMatchObject({ ok: false });
  });

  it('trims whitespace around each ID', () => {
    const value = questionIds().map((id) => `  ${id} \t`).join(', ');
    expect(parseQuestionIds(formWith(value))).toEqual({ ok: true, ids: questionIds() });
  });

  it('rejects a trailing comma as an empty item', () => {
    expect(parseQuestionIds(formWith(`${questionIds().join(',')},`))).toMatchObject({ ok: false });
  });
});
