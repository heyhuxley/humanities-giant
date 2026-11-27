import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {Button} from '@/components/stage/button';
import {Card} from '@/components/stage/card';
import {Field} from '@/components/stage/field';
import {InlineAlert} from '@/components/stage/inline-alert';
import {PageHeader} from '@/components/stage/page-header';

async function signIn(formData: FormData) {
	'use server';
	
	const email = String(formData.get('email') ?? '');
	const password = String(formData.get('password') ?? '');
	const supabase = await createClient();
	const {error} = await supabase.auth.signInWithPassword({email, password});
	if (error) redirect('/host/sign-in?error=invalid');
	redirect('/host');
}

export default async function HostSignInPage({searchParams}: Readonly<{ searchParams: Promise<{ error?: string }> }>) {
	const {error} = await searchParams;
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 outline-none sm:px-6 sm:py-12">
			<PageHeader title="Host sign in"/>
			<div className="mx-auto w-full max-w-xl">
				<Card heading="Welcome back">
					<p className="text-bone-muted">Sign in to manage your question bank and host a session.</p>
					<form action={signIn} className="space-y-5">
						<Field id="email" name="email" type="email" autoComplete="email" required label="Email"/>
						<Field id="password" name="password" type="password" autoComplete="current-password" required
						       label="Password"/>
						<Button type="submit" size="large">Sign in</Button>
					</form>
					{error === 'invalid' ? <InlineAlert>Invalid email or password</InlineAlert> : null}
				</Card>
			</div>
		</main>
	);
}
