import { describe, expect, it } from 'vitest';
import {
  parseKnockForm,
  parseSubmitAnswerForm,
  parseVoteForm,
} from './player-forms';

const SESSION_ID = 'A0B1C2D3-E4F5-4678-9012-ABCDEF012345';

function makeForm(fields: Record<string, string> = {}): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.append(name, value);
  return formData;
}

function formWithFile(field: string): FormData {
  const formData = new FormData();
  if (field !== 'sessionId') formData.append('sessionId', SESSION_ID);
  formData.append(field, new Blob(['not a string']), 'field.txt');
  return formData;
}

describe('parseSubmitAnswerForm', () => {
  it('accepts a UUID and option, returning normalized values', () => {
    expect(parseSubmitAnswerForm(makeForm({ sessionId: SESSION_ID, option: '2' }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
      option: 2,
    });
  });

  it.each(['4', '-1', '01', '1.5', ' 2', ''])('rejects option %j', (option) => {
    expect(parseSubmitAnswerForm(makeForm({ sessionId: SESSION_ID, option })))
      .toMatchObject({ ok: false });
  });

  it('rejects missing and non string options', () => {
    expect(parseSubmitAnswerForm(makeForm({ sessionId: SESSION_ID }))).toMatchObject({ ok: false });
    expect(parseSubmitAnswerForm(formWithFile('option'))).toMatchObject({ ok: false });
  });

  it.each([
    ['missing', makeForm({ option: '1' })],
    ['not a UUID', makeForm({ sessionId: 'not-a-uuid', option: '1' })],
  ])('rejects a %s session id', (_label, formData) => {
    expect(parseSubmitAnswerForm(formData)).toMatchObject({ ok: false });
  });

  it('rejects a non string session id', () => {
    expect(parseSubmitAnswerForm(formWithFile('sessionId'))).toMatchObject({ ok: false });
  });

  it('ignores extra fields', () => {
    expect(parseSubmitAnswerForm(makeForm({
      sessionId: SESSION_ID,
      option: '3',
      actorId: 'untrusted',
      event: 'reveal',
    }))).toMatchObject({ ok: true, option: 3 });
  });
});

describe('parseVoteForm', () => {
  it('accepts a UUID and option, returning normalized values', () => {
    expect(parseVoteForm(makeForm({ sessionId: SESSION_ID, option: '0' }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
      option: 0,
    });
  });

  it.each(['4', '-1', '01', '1.5', ' 2', ''])('rejects option %j', (option) => {
    expect(parseVoteForm(makeForm({ sessionId: SESSION_ID, option }))).toMatchObject({ ok: false });
  });

  it('rejects missing and non string options', () => {
    expect(parseVoteForm(makeForm({ sessionId: SESSION_ID }))).toMatchObject({ ok: false });
    expect(parseVoteForm(formWithFile('option'))).toMatchObject({ ok: false });
  });

  it.each([
    ['missing', makeForm({ option: '1' })],
    ['not a UUID', makeForm({ sessionId: 'not-a-uuid', option: '1' })],
  ])('rejects a %s session id', (_label, formData) => {
    expect(parseVoteForm(formData)).toMatchObject({ ok: false });
  });

  it('rejects a non string session id', () => {
    expect(parseVoteForm(formWithFile('sessionId'))).toMatchObject({ ok: false });
  });

  it('ignores extra fields', () => {
    expect(parseVoteForm(makeForm({
      sessionId: SESSION_ID,
      option: '3',
      userId: 'untrusted',
      event: 'vote',
    }))).toMatchObject({ ok: true, option: 3 });
  });
});

describe('parseKnockForm', () => {
  it('accepts a UUID and returns its lowercase form', () => {
    expect(parseKnockForm(makeForm({ sessionId: SESSION_ID }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
    });
  });

  it.each([
    ['missing', makeForm()],
    ['not a UUID', makeForm({ sessionId: 'not-a-uuid' })],
  ])('rejects a %s session id', (_label, formData) => {
    expect(parseKnockForm(formData)).toMatchObject({ ok: false });
  });

  it('rejects a non string session id', () => {
    expect(parseKnockForm(formWithFile('sessionId'))).toMatchObject({ ok: false });
  });

  it('ignores extra fields', () => {
    expect(parseKnockForm(makeForm({
      sessionId: SESSION_ID,
      actorId: 'untrusted',
      event: 'start',
    }))).toMatchObject({ ok: true });
  });
});
