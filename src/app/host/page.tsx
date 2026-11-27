import {redirect} from 'next/navigation';
import Link from 'next/link';
import {requireHost} from '@/lib/auth/require-host';
import {createClient} from '@/lib/supabase/server';
import {Button} from '@/components/stage/button';
import {Card} from '@/components/stage/card';
import {PageHeader} from '@/components/stage/page-header';

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
	const {data} = await supabase.auth.getClaims();
	const email = typeof data?.claims.email === 'string' ? data.claims.email : '';
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 outline-none sm:px-6 sm:py-12">
			<PageHeader title="Host home"/>
			<p className="text-bone-muted">Signed in as <span className="break-all text-bone">{email}</span></p>
			<Card className="space-y-6">
				<div>
					<h2 className="font-display text-2xl font-semibold">Run a humanities quiz</h2>
					<p className="mt-2 max-w-prose text-bone-muted">Choose questions, prepare a session, and guide the
						game from your host controls.</p>
				</div>
				<nav aria-label="Host tasks" className="grid gap-3 sm:grid-cols-3">
					<Link
						className="press inline-flex min-h-14 items-center justify-center rounded-sm border border-rule bg-slab-raised px-4 py-3 text-center font-semibold text-bone underline-offset-4 hover:border-ember hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
						href="/host/sessions">
						View sessions
					</Link>
					<Link
						className="press inline-flex min-h-14 items-center justify-center rounded-sm border border-ember bg-ember px-4 py-3 text-center font-semibold text-ink underline-offset-4 hover:bg-ember/85 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
						href="/host/sessions/new">
						Create a session
					</Link>
					<Link
						className="press inline-flex min-h-14 items-center justify-center rounded-sm border border-rule bg-slab-raised px-4 py-3 text-center font-semibold text-bone underline-offset-4 hover:border-ember hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
						href="/host/questions">
						Manage question bank
					</Link>
				</nav>
			</Card>
			<form action={signOut}>
				<Button type="submit" variant="secondary">Sign out</Button>
			</form>
		</main>
	);
}
