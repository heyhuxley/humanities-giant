import { describe, expect, it, vi } from 'vitest';
import { toLoadedSession, toQuestionRow } from './session-event-deps';

vi.mock('server-only', () => ({}));

const engineState = { status: 'waiting' };
const currentQuestion = { id: 'question-id', text: 'Question', options: ['A', 'B', 'C', 'D'] };

describe('toLoadedSession', () => {
  const baseRow = {
    engine_state: engineState,
    version: 3,
    sessions: {
      host_id: 'host-id',
      current_question: currentQuestion,
    },
  };

  it('maps an object session embed', () => {
    expect(toLoadedSession(baseRow)).toEqual({
      hostId: 'host-id',
      engineState,
      version: 3,
      currentQuestion,
    });
  });

  it('maps a one element array session embed', () => {
    expect(toLoadedSession({ ...baseRow, sessions: [baseRow.sessions] })).toEqual({
      hostId: 'host-id',
      engineState,
      version: 3,
      currentQuestion,
    });
  });

  it('returns null for a missing session embed', () => {
    expect(toLoadedSession({ ...baseRow, sessions: null })).toBeNull();
    expect(toLoadedSession({ engine_state: engineState, version: 3 })).toBeNull();
  });

  it.each([
    ['missing engine state', { ...baseRow, engine_state: null }],
    ['engine state without a string status', { ...baseRow, engine_state: { status: 1 } }],
    ['array engine state', { ...baseRow, engine_state: [] }],
    ['missing version', { ...baseRow, version: undefined }],
    ['non integer version', { ...baseRow, version: 1.5 }],
    ['negative version', { ...baseRow, version: -1 }],
    ['multiple session embeds', { ...baseRow, sessions: [baseRow.sessions, baseRow.sessions] }],
    ['session embed without current question', {
      ...baseRow,
      sessions: { host_id: 'host-id' },
    }],
  ])('returns null for %s', (_label, row) => {
    expect(toLoadedSession(row)).toBeNull();
  });

  it('returns null for a null row', () => {
    expect(toLoadedSession(null)).toBeNull();
  });
});

describe('toQuestionRow', () => {
  it('maps a valid question row', () => {
    expect(toQuestionRow({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
    })).toEqual({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
    });
  });

  it('returns null when columns are missing', () => {
    expect(toQuestionRow({ id: 'question-id', text: 'Question' })).toBeNull();
    expect(toQuestionRow({ text: 'Question', options: ['A', 'B', 'C', 'D'] })).toBeNull();
  });

  it('drops extra columns', () => {
    expect(toQuestionRow({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
      correct_index: 2,
      secret: 'private',
    })).toEqual({
      id: 'question-id',
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
    });
  });

  it.each([
    ['not an array', 'A, B, C, D'],
    ['an array with three options', ['A', 'B', 'C']],
    ['an array with five options', ['A', 'B', 'C', 'D', 'E']],
    ['an array with a non string option', ['A', 'B', 3, 'D']],
  ])('returns null when options are %s', (_label, options) => {
    expect(toQuestionRow({ id: 'question-id', text: 'Question', options })).toBeNull();
  });
});
