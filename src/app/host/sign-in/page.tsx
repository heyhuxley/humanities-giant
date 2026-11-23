import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function signIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/host/sign-in?error=invalid');
  redirect('/host');
}

export default async function HostSignInPage({ searchParams }: Readonly<{ searchParams: Promise<{ error?: string }> }>) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>Host sign in</h1>
      <form action={signIn}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit">Sign in</button>
      </form>
      {error === 'invalid' ? <p role="alert">Invalid email or password</p> : null}
    </main>
  );
}
