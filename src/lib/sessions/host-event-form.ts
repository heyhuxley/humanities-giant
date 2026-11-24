const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export type SetContestantFormResult =
  | { ok: true; sessionId: string; participantId: string }
  | { ok: false; error: string };

export type StartFormResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export type EndSessionFormResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

function readUuid(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function parseSetContestantForm(formData: FormData): SetContestantFormResult {
  const sessionId = readUuid(formData, 'sessionId');
  const participantId = readUuid(formData, 'participantId');
  if (sessionId === null || participantId === null) {
    return { ok: false, error: 'This request is not valid. Reload the page and try again.' };
  }

  return { ok: true, sessionId, participantId };
}

export function parseStartForm(formData: FormData): StartFormResult {
  const sessionId = readUuid(formData, 'sessionId');
  if (sessionId === null) {
    return { ok: false, error: 'This request is not valid. Reload the page and try again.' };
  }

  return { ok: true, sessionId };
}

export function parseEndSessionForm(formData: FormData): EndSessionFormResult {
  const sessionId = readUuid(formData, 'sessionId');
  if (sessionId === null) {
    return { ok: false, error: 'This request is not valid. Reload the page and try again.' };
  }

  return { ok: true, sessionId };
}
