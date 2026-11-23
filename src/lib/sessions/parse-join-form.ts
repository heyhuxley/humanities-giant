import { normalizeDisplayName } from './display-name';
import { normalizeJoinCode } from './join-code';

export type JoinFormErrors = {
  code?: string;
  displayName?: string;
};

export type JoinFormValues = {
  code: string;
  displayName: string;
};

export type ParseJoinFormResult =
  | { ok: true; code: string; displayName: string }
  | { ok: false; errors: JoinFormErrors };

export function parseJoinForm(formData: FormData): ParseJoinFormResult {
  const normalizedCode = normalizeJoinCode(formData.get('code'));
  const normalizedDisplayName = normalizeDisplayName(formData.get('displayName'));
  const errors: JoinFormErrors = {};

  if (normalizedCode === null) errors.code = 'Enter a valid six character join code.';
  if (!normalizedDisplayName.ok) errors.displayName = normalizedDisplayName.error;

  if (normalizedCode === null || !normalizedDisplayName.ok) return { ok: false, errors };
  return { ok: true, code: normalizedCode, displayName: normalizedDisplayName.value };
}
