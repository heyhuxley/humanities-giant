import { describe, expect, it } from 'vitest';
import { validateQuestionInput } from './validate';

const valid = () => ({ subject: 'english', difficulty: 'easy', text: '  A question?  ', options: [' One ', 'Two', 'Three', 'Four'], correctIndex: 2 });
const rejected = (input: unknown) => {
  const result = validateQuestionInput(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected invalid input');
  return result.errors;
};

describe('validateQuestionInput', () => {
  it('returns trimmed validated values', () => {
    expect(validateQuestionInput(valid())).toEqual({ ok: true, value: { subject: 'english', difficulty: 'easy', text: 'A question?', options: ['One', 'Two', 'Three', 'Four'], correctIndex: 2 } });
  });
  it.each([
    ['subject', 'subject'], ['difficulty', 'difficulty'], ['text', 'text'], ['options', 'options'], ['correctIndex', 'correctIndex'],
  ])('requires the %s field', (field, errorKey) => {
    const input = valid();
    delete input[field as keyof typeof input];
    expect(rejected(input)).toHaveProperty(errorKey);
  });
  it.each([
    ['subject', 1], ['difficulty', false], ['text', 3], ['options', 'not options'], ['correctIndex', '2'],
  ])('rejects a wrong type for %s', (field, value) => {
    expect(rejected({ ...valid(), [field]: value })).toHaveProperty(field);
  });
  it('rejects unknown subject and difficulty values', () => {
    expect(rejected({ ...valid(), subject: 'history' })).toHaveProperty('subject');
    expect(rejected({ ...valid(), difficulty: 'expert' })).toHaveProperty('difficulty');
  });
  it.each(['', '   '])('rejects empty text %j', (text) => expect(rejected({ ...valid(), text })).toHaveProperty('text'));
  it('accepts 200 characters and rejects 201', () => {
    expect(validateQuestionInput({ ...valid(), text: 'x'.repeat(200) }).ok).toBe(true);
    expect(rejected({ ...valid(), text: 'x'.repeat(201) })).toHaveProperty('text');
  });
  it.each([{ options: [1, 2, 3] }, { options: [1, 2, 3, 4, 5] }])('rejects an option list with the wrong length', ({ options }) => expect(rejected({ ...valid(), options })).toHaveProperty('options'));
  it('rejects empty and overlong options', () => {
    expect(rejected({ ...valid(), options: ['', 'Two', 'Three', 'Four'] })).toHaveProperty('options');
    expect(rejected({ ...valid(), options: ['x'.repeat(81), 'Two', 'Three', 'Four'] })).toHaveProperty('options');
  });
  it('rejects options duplicated by case', () => expect(rejected({ ...valid(), options: ['Choice', 'choice', 'Three', 'Four'] })).toHaveProperty('options'));
  it.each([-1, 4, 1.5, '2'])('rejects invalid correct index %s', (correctIndex) => expect(rejected({ ...valid(), correctIndex })).toHaveProperty('correctIndex'));
  it.each([null, 1, 'question', []])('rejects non object input %j', (input) => expect(rejected(input)).toHaveProperty('subject'));
  it('reports multiple field errors together', () => {
    expect(rejected({ subject: 'other', difficulty: 'harder', text: ' ', options: ['a'], correctIndex: 9 })).toEqual({
      subject: expect.any(String), difficulty: expect.any(String), text: expect.any(String), options: expect.any(String), correctIndex: expect.any(String),
    });
  });
  it('does not mutate its input', () => {
    const input = valid();
    const before = structuredClone(input);
    validateQuestionInput(input);
    expect(input).toEqual(before);
  });
});
