import { redirect } from 'next/navigation';
import { requireHost } from '@/lib/auth/require-host';
import { createClient } from '@/lib/supabase/server';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/host/sign-in');
}

export default async function HostPage() {
  await requireHost();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === 'string' ? data.claims.email : '';
  return (
    <main>
      <p>Signed in as {email}</p>
      <form action={signOut}><button type="submit">Sign out</button></form>
    </main>
  );
}
