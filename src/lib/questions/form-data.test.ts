import { describe, expect, it } from 'vitest';
import { formDataToQuestionInput } from './form-data';

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.set(key, value);
  return data;
}

describe('formDataToQuestionInput', () => {
  it('reads a complete form and parses the correct index', () => {
    expect(formDataToQuestionInput(form([['subject', 'english'], ['difficulty', 'easy'], ['text', 'Question'], ['option0', 'A'], ['option1', 'B'], ['option2', 'C'], ['option3', 'D'], ['correctIndex', '2']]))).toEqual({ subject: 'english', difficulty: 'easy', text: 'Question', options: ['A', 'B', 'C', 'D'], correctIndex: 2 });
  });
  it('keeps missing fields as null for validation', () => {
    expect(formDataToQuestionInput(form([]))).toEqual({ subject: null, difficulty: null, text: null, options: [null, null, null, null], correctIndex: null });
  });
  it('ignores extra fields', () => {
    expect(formDataToQuestionInput(form([['extra', 'ignored'], ['correctIndex', '0']]))).toMatchObject({ correctIndex: 0 });
    expect(formDataToQuestionInput(form([['extra', 'ignored'], ['correctIndex', '0']]))).not.toHaveProperty('extra');
  });
  it('leaves non numeric correct index text for validation', () => {
    expect(formDataToQuestionInput(form([['correctIndex', 'nope']]))).toMatchObject({ correctIndex: 'nope' });
  });
});
