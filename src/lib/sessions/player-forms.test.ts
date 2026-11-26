import { describe, expect, it } from 'vitest';
import {
  parseKnockForm,
  parseLifelineForm,
  parseSubmitAnswerForm,
  parseVoteForm,
  parseWalkAwayForm,
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

describe('parseWalkAwayForm', () => {
  it('accepts a UUID and returns its lowercase form', () => {
    expect(parseWalkAwayForm(makeForm({ sessionId: SESSION_ID }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
    });
  });

  it.each([
    ['missing', makeForm()],
    ['not a UUID', makeForm({ sessionId: 'not-a-uuid' })],
  ])('rejects a %s session id', (_label, formData) => {
    expect(parseWalkAwayForm(formData)).toMatchObject({ ok: false });
  });

  it('rejects a File value for the session id', () => {
    expect(parseWalkAwayForm(formWithFile('sessionId'))).toMatchObject({ ok: false });
  });

  it('ignores extra fields without echoing them', () => {
    expect(parseWalkAwayForm(makeForm({
      sessionId: SESSION_ID,
      actorId: 'untrusted',
      event: 'end_session',
    }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
    });
  });
});

describe('parseLifelineForm', () => {
  it.each(['fifty_fifty', 'phone', 'audience'] as const)(
    'accepts the %s lifeline',
    (lifeline) => {
      expect(parseLifelineForm(makeForm({ sessionId: SESSION_ID, lifeline }))).toEqual({
        ok: true,
        sessionId: SESSION_ID.toLowerCase(),
        lifeline,
      });
    },
  );

  it('returns an uppercase UUID in lowercase', () => {
    expect(parseLifelineForm(makeForm({
      sessionId: SESSION_ID,
      lifeline: 'phone',
    }))).toMatchObject({ ok: true, sessionId: SESSION_ID.toLowerCase() });
  });

  it.each([
    ['missing session id', makeForm({ lifeline: 'phone' })],
    ['missing lifeline', makeForm({ sessionId: SESSION_ID })],
    ['both fields', makeForm()],
    ['invalid session id', makeForm({ sessionId: 'not-a-uuid', lifeline: 'phone' })],
  ])('rejects %s', (_label, formData) => {
    expect(parseLifelineForm(formData)).toMatchObject({ ok: false });
  });

  it.each(['sessionId', 'lifeline'])('rejects a File value for %s', (field) => {
    const formData = new FormData();
    formData.append('sessionId', SESSION_ID);
    formData.append('lifeline', 'phone');
    formData.delete(field);
    formData.append(field, new Blob(['not a string']), 'field.txt');
    expect(parseLifelineForm(formData)).toMatchObject({ ok: false });
  });

  it.each(['FIFTY_FIFTY', ' phone', '50:50', '', 'fiftyFifty'])(
    'rejects malformed lifeline %j',
    (lifeline) => {
      expect(parseLifelineForm(makeForm({ sessionId: SESSION_ID, lifeline })))
        .toMatchObject({ ok: false });
    },
  );

  it('ignores extra fields without echoing them', () => {
    const result = parseLifelineForm(makeForm({
      sessionId: SESSION_ID,
      lifeline: 'fifty_fifty',
      remove: '0,1',
      hint: '2',
      voteCounts: '1,2,3,4',
      correctIndex: '2',
    }));

    expect(result).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
      lifeline: 'fifty_fifty',
    });
  });
});
