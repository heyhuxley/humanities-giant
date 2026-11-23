'use server';

import { redirect } from 'next/navigation';
import { isHostClaims } from '@/lib/auth/is-host';
import { joinFailureMessage, HOST_JOIN_MESSAGE } from '@/lib/sessions/join-messages';
import { joinSession, type JoinSessionResult } from '@/lib/sessions/join-session';
import { parseJoinForm, type JoinFormErrors, type JoinFormValues } from '@/lib/sessions/parse-join-form';
import { createClient } from '@/lib/supabase/server';

export type JoinSessionActionState = {
  errors: JoinFormErrors;
  formError: string | null;
  values: JoinFormValues;
};

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function submittedValues(formData: FormData): JoinFormValues {
  return {
    code: stringField(formData, 'code'),
    displayName: stringField(formData, 'displayName'),
  };
}

function getSubject(claims: unknown): string | null {
  if (typeof claims !== 'object' || claims === null || !('sub' in claims)) return null;
  return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
}

function statusOrCode(error: unknown): number | string | null {
  if (typeof error !== 'object' || error === null) return null;
  if ('status' in error && typeof error.status === 'number') return error.status;
  return 'code' in error && typeof error.code === 'string' ? error.code : null;
}

function logAnonymousSignInFailure(error: unknown): void {
  console.error('[join] anonymous sign in failed:', statusOrCode(error));
}

function failedState(formError: string, values: JoinFormValues): JoinSessionActionState {
  return { errors: {}, formError, values };
}

export async function joinSessionAction(
  _previous: JoinSessionActionState,
  formData: FormData,
): Promise<JoinSessionActionState> {
  const values = submittedValues(formData);
  const parsed = parseJoinForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, formError: null, values };

  const normalizedValues = { code: parsed.code, displayName: parsed.displayName };
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return failedState(joinFailureMessage('unknown'), normalizedValues);
  }

  let claims: unknown = null;
  try {
    const result = await supabase.auth.getClaims();
    if (result.error) return failedState(joinFailureMessage('unknown'), normalizedValues);
    claims = result.data?.claims ?? null;
  } catch {
    return failedState(joinFailureMessage('unknown'), normalizedValues);
  }

  if (isHostClaims(claims)) return failedState(HOST_JOIN_MESSAGE, normalizedValues);

  let userId = getSubject(claims);
  if (userId === null) {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        logAnonymousSignInFailure(error);
        return failedState(joinFailureMessage('unknown'), normalizedValues);
      }
      userId = data.user?.id ?? null;
      if (userId === null) {
        logAnonymousSignInFailure(null);
        return failedState(joinFailureMessage('unknown'), normalizedValues);
      }
    } catch (error) {
      logAnonymousSignInFailure(error);
      return failedState(joinFailureMessage('unknown'), normalizedValues);
    }
  }

  let result: JoinSessionResult;
  try {
    result = await joinSession(userId, parsed.code, parsed.displayName);
  } catch {
    return failedState(joinFailureMessage('unknown'), normalizedValues);
  }
  if (!result.ok) return failedState(joinFailureMessage(result.reason), normalizedValues);
  redirect(`/play/${result.sessionId}`);
}
