import { describe, expect, it } from 'vitest';
import { readCurrentQuestion, readPublicState } from './read-public-state';

describe('readPublicState', () => {
  it('reads a valid waiting state', () => {
    expect(readPublicState({
      status: 'waiting',
      winnings: null,
      finishReason: null,
    })).toEqual({
      status: 'waiting',
      winnings: null,
      finishReason: null,
    });
  });

  it('reads a valid question_active state with a question without exposing the answer index', () => {
    const result = readPublicState({
      status: 'question_active',
      winnings: null,
      finishReason: null,
      correctIndex: 2,
      answer: 'secret',
      ignored: 'extra',
    });
    const question = readCurrentQuestion({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
    });

    expect(result).toEqual({
      status: 'question_active',
      winnings: null,
      finishReason: null,
    });
    expect(result).not.toHaveProperty('correctIndex');
    expect(question).toEqual({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
    });
    expect(question).not.toHaveProperty('correctIndex');
  });

  it('reads finished winnings and reason', () => {
    expect(readPublicState({
      status: 'finished',
      winnings: 30000,
      finishReason: 'walked_away',
    })).toEqual({
      status: 'finished',
      winnings: 30000,
      finishReason: 'walked_away',
    });
  });

  it.each([
    ['missing status', { winnings: null, finishReason: null }],
    ['missing winnings', { status: 'waiting', finishReason: null }],
    ['missing finish reason', { status: 'waiting', winnings: null }],
    ['unknown status', { status: 'paused', winnings: null, finishReason: null }],
    ['string winnings', { status: 'finished', winnings: '30000', finishReason: 'won' }],
    ['fractional winnings', { status: 'finished', winnings: 1.5, finishReason: 'won' }],
    ['unknown finish reason', { status: 'finished', winnings: 0, finishReason: 'other' }],
  ])('returns null for %s', (_label, value) => {
    expect(readPublicState(value)).toBeNull();
  });

  it('returns null for non object values', () => {
    expect(readPublicState(null)).toBeNull();
    expect(readPublicState([])).toBeNull();
  });
});

describe('readCurrentQuestion', () => {
  it('reads an active question and ignores extra properties', () => {
    const result = readCurrentQuestion({
      id: 'question-id',
      text: 'Question text',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      correct_index: 2,
      answer: 'C',
    });

    expect(result).toEqual({
      id: 'question-id',
      text: 'Question text',
      options: ['A', 'B', 'C', 'D'],
    });
    expect(result).not.toHaveProperty('correctIndex');
    expect(result).not.toHaveProperty('correct_index');
    expect(result).not.toHaveProperty('answer');
  });

  it('returns null for a missing question', () => {
    expect(readCurrentQuestion(null)).toBeNull();
  });

  it.each([
    ['missing id', { text: 'Question', options: ['A', 'B', 'C', 'D'] }],
    ['empty text', { id: 'question-id', text: '', options: ['A', 'B', 'C', 'D'] }],
    ['three options', { id: 'question-id', text: 'Question', options: ['A', 'B', 'C'] }],
    ['non string option', { id: 'question-id', text: 'Question', options: ['A', 'B', 3, 'D'] }],
  ])('returns null for a malformed question with %s', (_label, value) => {
    expect(readCurrentQuestion(value)).toBeNull();
  });
});
