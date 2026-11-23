import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireHost } from '@/lib/auth/require-host';
import { createClient } from '@/lib/supabase/server';

async function signOut() {
  'use server';
  await requireHost();
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
      <p><Link href="/host/questions">Manage question bank</Link></p>
      <p><Link href="/host/sessions/new">Create a session</Link></p>
      <form action={signOut}><button type="submit">Sign out</button></form>
    </main>
  );
}
