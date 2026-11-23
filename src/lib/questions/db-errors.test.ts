import { describe, expect, it } from 'vitest';
import { mapQuestionDbError } from './db-errors';

describe('mapQuestionDbError', () => {
  it('maps foreign key errors to the delete message', () => {
    expect(mapQuestionDbError({ code: '23503', message: 'private database text' })).toBe("This question is used in a session and can't be deleted.");
  });
  it.each([{}, { code: 'other', message: 'private database text' }, undefined, null])('hides unrecognized database errors', (error) => {
    expect(mapQuestionDbError(error)).toBe('Something went wrong. Try again.');
  });
});
