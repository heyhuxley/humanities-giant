const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export type ParseQuestionIdsResult = { ok: true; ids: string[] } | { ok: false; error: string };

export function parseQuestionIds(formData: FormData): ParseQuestionIdsResult {
  const value = formData.get('questionIds');
  if (typeof value !== 'string') return { ok: false, error: 'Enter 15 question IDs.' };

  const items = value.split(',').map((item) => item.trim());
  if (items.some((item) => item.length === 0)) return { ok: false, error: 'Remove empty question IDs.' };
  if (items.length !== 15) return { ok: false, error: 'Select exactly 15 questions.' };
  if (items.some((item) => !UUID_PATTERN.test(item))) return { ok: false, error: 'One or more question IDs are invalid.' };

  const ids = items.map((item) => item.toLowerCase());
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'Each question can only be selected once.' };
  return { ok: true, ids };
}
