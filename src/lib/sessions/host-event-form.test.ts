import { describe, expect, it } from 'vitest';
import {
  parseEndSessionForm,
  parseNextForm,
  parseRevealForm,
  parseSetContestantForm,
  parseStartForm,
} from './host-event-form';

function makeForm(fields: Record<string, string | File> = {}): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.append(name, value);
  return formData;
}

const SESSION_ID = 'A0B1C2D3-E4F5-4678-9012-ABCDEF012345';
const PARTICIPANT_ID = 'B1C2D3E4-F567-4890-A123-BCDEF0123456';

describe('parseSetContestantForm', () => {
  it('accepts UUID fields and returns lowercase ids', () => {
    expect(parseSetContestantForm(makeForm({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
      participantId: PARTICIPANT_ID.toLowerCase(),
    });
  });

  it.each([
    ['missing session id', { participantId: PARTICIPANT_ID }],
    ['missing participant id', { sessionId: SESSION_ID }],
    ['non UUID session id', { sessionId: 'not-a-uuid', participantId: PARTICIPANT_ID }],
    ['non UUID participant id', { sessionId: SESSION_ID, participantId: 'not-a-uuid' }],
  ])('rejects a %s', (_label, fields) => {
    expect(parseSetContestantForm(makeForm(fields))).toMatchObject({ ok: false });
  });

  it.each(['sessionId', 'participantId'])('rejects a non string %s field', (field) => {
    const formData = new FormData();
    if (field === 'sessionId') {
      formData.append('sessionId', new Blob(['file']), 'session.txt');
      formData.append('participantId', PARTICIPANT_ID);
    } else {
      formData.append('sessionId', SESSION_ID);
      formData.append('participantId', new Blob(['file']), 'participant.txt');
    }
    expect(parseSetContestantForm(formData)).toMatchObject({ ok: false });
  });

  it('ignores extra fields', () => {
    expect(parseSetContestantForm(makeForm({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      actorId: 'untrusted',
      type: 'reveal',
    }))).toMatchObject({ ok: true });
  });
});

describe('parseStartForm', () => {
  it('accepts a UUID and returns its lowercase form', () => {
    expect(parseStartForm(makeForm({ sessionId: SESSION_ID }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
    });
  });

  it.each([
    ['missing', makeForm()],
    ['not a UUID', makeForm({ sessionId: 'not-a-uuid' })],
  ])('rejects a %s session id', (_label, formData) => {
    expect(parseStartForm(formData)).toMatchObject({ ok: false });
  });

  it('rejects a non string field', () => {
    const formData = new FormData();
    formData.append('sessionId', new Blob(['file']), 'session.txt');
    expect(parseStartForm(formData)).toMatchObject({ ok: false });
  });

  it('ignores extra fields', () => {
    expect(parseStartForm(makeForm({ sessionId: SESSION_ID, actorId: 'untrusted' }))).toMatchObject({
      ok: true,
    });
  });
});

describe('parseEndSessionForm', () => {
  it('accepts a UUID and returns its lowercase form', () => {
    expect(parseEndSessionForm(makeForm({ sessionId: SESSION_ID }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
    });
  });

  describe.each([
    ['parseRevealForm', parseRevealForm],
    ['parseNextForm', parseNextForm],
  ])('%s', (_name, parseForm) => {
    it('accepts a UUID and returns its lowercase form', () => {
      expect(parseForm(makeForm({ sessionId: SESSION_ID }))).toEqual({
        ok: true,
        sessionId: SESSION_ID.toLowerCase(),
      });
    });

    it.each([
      ['missing', makeForm()],
      ['not a UUID', makeForm({ sessionId: 'not-a-uuid' })],
    ])('rejects a %s session id', (_label, formData) => {
      expect(parseForm(formData)).toMatchObject({ ok: false });
    });

    it('rejects a non-string value', () => {
      const formData = new FormData();
      Object.defineProperty(formData, 'get', { value: () => 42 });
      expect(parseForm(formData)).toMatchObject({ ok: false });
    });

    it('rejects a File value', () => {
      const formData = new FormData();
      formData.append('sessionId', new Blob(['file']), 'session.txt');
      expect(parseForm(formData)).toMatchObject({ ok: false });
    });

    it('ignores extra fields', () => {
      expect(parseForm(makeForm({ sessionId: SESSION_ID, type: 'untrusted' }))).toEqual({
        ok: true,
        sessionId: SESSION_ID.toLowerCase(),
      });
    });
  });

  it.each([
    ['missing', makeForm()],
    ['not a UUID', makeForm({ sessionId: 'not-a-uuid' })],
  ])('rejects a %s session id', (_label, formData) => {
    expect(parseEndSessionForm(formData)).toMatchObject({ ok: false });
  });

  it('rejects a non string field', () => {
    const formData = new FormData();
    formData.append('sessionId', new Blob(['file']), 'session.txt');
    expect(parseEndSessionForm(formData)).toMatchObject({ ok: false });
  });

  it('ignores extra fields', () => {
    expect(parseEndSessionForm(makeForm({ sessionId: SESSION_ID, actorId: 'untrusted' }))).toEqual({
      ok: true,
      sessionId: SESSION_ID.toLowerCase(),
    });
  });
});
