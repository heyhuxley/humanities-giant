import 'server-only';

import { redirect } from 'next/navigation';
import { isHostClaims } from './is-host';
import { createClient } from '../supabase/server';

export async function requireHost(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;
  if (error || !isHostClaims(claims) || typeof subject !== 'string') redirect('/host/sign-in');
  return subject;
}
