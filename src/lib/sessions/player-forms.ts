const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const OPTION_PATTERN = /^[0-3]$/;
const INVALID_FORM_ERROR = 'This request is not valid. Reload the page and try again.';

export type PlayerFormError = { ok: false; error: string };
export type SubmitAnswerFormResult =
  | { ok: true; sessionId: string; option: 0 | 1 | 2 | 3 }
  | PlayerFormError;
export type VoteFormResult =
  | { ok: true; sessionId: string; option: 0 | 1 | 2 | 3 }
  | PlayerFormError;
export type KnockFormResult = { ok: true; sessionId: string } | PlayerFormError;

function readSessionId(formData: FormData): string | null {
  const value = formData.get('sessionId');
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function readOption(formData: FormData): 0 | 1 | 2 | 3 | null {
  const value = formData.get('option');
  if (typeof value !== 'string' || !OPTION_PATTERN.test(value)) return null;
  switch (value) {
    case '0':
      return 0;
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    default:
      return null;
  }
}

export function parseSubmitAnswerForm(formData: FormData): SubmitAnswerFormResult {
  const sessionId = readSessionId(formData);
  const option = readOption(formData);
  if (sessionId === null || option === null) return { ok: false, error: INVALID_FORM_ERROR };
  return { ok: true, sessionId, option };
}

export function parseVoteForm(formData: FormData): VoteFormResult {
  const sessionId = readSessionId(formData);
  const option = readOption(formData);
  if (sessionId === null || option === null) return { ok: false, error: INVALID_FORM_ERROR };
  return { ok: true, sessionId, option };
}

export function parseKnockForm(formData: FormData): KnockFormResult {
  const sessionId = readSessionId(formData);
  if (sessionId === null) return { ok: false, error: INVALID_FORM_ERROR };
  return { ok: true, sessionId };
}
