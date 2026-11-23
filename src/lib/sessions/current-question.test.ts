import { describe, expect, it } from 'vitest';
import { buildCurrentQuestion, type CurrentQuestion } from './current-question';

const question: CurrentQuestion = {
  id: 'question-id',
  text: 'Which option is correct?',
  options: ['A', 'B', 'C', 'D'],
};

describe('buildCurrentQuestion', () => {
  it.each(['question_active', 'locked', 'revealed'] as const)(
    'returns the visible question for %s',
    (status) => {
      expect(buildCurrentQuestion(status, question)).toEqual(question);
    },
  );

  it.each(['waiting', 'finished'] as const)(
    'returns null for %s even when a question is passed',
    (status) => {
      expect(buildCurrentQuestion(status, question)).toBeNull();
    },
  );

  it.each(['question_active', 'locked', 'revealed'] as const)(
    'throws when the question is missing for %s',
    (status) => {
      expect(() => buildCurrentQuestion(status, null)).toThrow(Error);
    },
  );

  it('omits answer related and other extra properties', () => {
    const result = buildCurrentQuestion('revealed', {
      ...question,
      correct_index: 1,
      correctIndex: 1,
      answer: 'B',
      anything: 'unexpected',
    });

    expect(result).toEqual(question);
    expect(result).not.toHaveProperty('correct_index');
    expect(result).not.toHaveProperty('correctIndex');
    expect(result).not.toHaveProperty('answer');
    expect(result).not.toHaveProperty('anything');
  });

  it('copies options so changes to the result do not change the input', () => {
    const input = { ...question, options: [...question.options] };
    const result = buildCurrentQuestion('question_active', input);

    if (result === null) throw new Error('Expected a current question.');
    result.options[0] = 'Changed';

    expect(input.options[0]).toBe('A');
  });

  it.each([
    ['three options', ['A', 'B', 'C']],
    ['five options', ['A', 'B', 'C', 'D', 'E']],
    ['a non-string option', ['A', 'B', 'C', 4]],
    ['a sparse options array', new Array(4)],
  ])('throws for %s', (_label, options) => {
    expect(() => buildCurrentQuestion('question_active', { ...question, options })).toThrow(
      'The question is malformed.',
    );
  });

  it.each([
    ['empty id', { ...question, id: '' }],
    ['empty text', { ...question, text: '' }],
  ])('throws for %s', (_label, malformedQuestion) => {
    expect(() => buildCurrentQuestion('question_active', malformedQuestion)).toThrow(
      'The question is malformed.',
    );
  });

  it('does not mutate the input question or its options', () => {
    const input = { ...question, options: [...question.options] };
    const originalOptions = [...input.options];

    buildCurrentQuestion('question_active', input);

    expect(input).toEqual({ ...question, options: originalOptions });
    expect(input.options).toEqual(originalOptions);
  });
});
