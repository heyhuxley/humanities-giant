import Link from 'next/link';
import {requireHost} from '@/lib/auth/require-host';
import {createClient} from '@/lib/supabase/server';
import {toSessionListItem} from '@/lib/sessions/session-list';
import {Badge} from '@/components/stage/badge';
import {Button} from '@/components/stage/button';
import {Card} from '@/components/stage/card';
import {PageHeader} from '@/components/stage/page-header';

function statusLabel(status: string): string {
	return status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export default async function HostSessionsPage() {
	const hostId = await requireHost();
	const supabase = await createClient();
	const {data, error} = await supabase
		.from('sessions')
		.select('id, code, public_state, created_at')
		.eq('host_id', hostId)
		.order('created_at', {ascending: false})
		.order('id')
		.limit(50);
	if (error) throw new Error('Unable to load sessions.');
	
	const rows: unknown = data;
	const sessions = Array.isArray(rows)
		? rows.map(toSessionListItem).filter((session) => session !== null)
		: [];
	
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6 sm:py-12">
			<PageHeader title="Your sessions"/>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<p className="max-w-prose text-bone-muted">Review and manage the sessions you have hosted.</p>
				<Link href="/host/sessions/new"><Button>Create a session</Button></Link>
			</div>
			{sessions.length === 0 ? (
				<Card className="text-center">
					<h2 className="font-display text-2xl font-semibold">Your sessions will appear here</h2>
					<p className="text-bone-muted">You haven&apos;t created any sessions yet.</p>
					<Link href="/host/sessions/new"><Button size="large">Create your first session</Button></Link>
				</Card>
			) : (
				<div className="overflow-x-auto rounded-sm border border-rule">
					<table className="w-full min-w-max border-collapse text-left">
						<thead className="bg-slab text-sm text-bone-muted">
						<tr>
							<th scope="col" className="px-4 py-3 font-semibold">Join code</th>
							<th scope="col" className="px-4 py-3 font-semibold">Status</th>
							<th scope="col" className="px-4 py-3 font-semibold">Created</th>
							<th scope="col" className="px-4 py-3 font-semibold"><span
								className="sr-only">Session link</span></th>
						</tr>
						</thead>
						<tbody className="divide-y divide-rule">
						{sessions.map((session) => (
							<tr key={session.id}
							    className={session.status === 'finished' ? 'bg-ink text-bone-muted' : 'bg-slab'}>
								<th scope="row" className="px-4 py-4 font-display text-lg font-semibold tracking-wide">
									<Link href={`/host/sessions/${session.id}`}
									      className="underline decoration-rule underline-offset-4 hover:decoration-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">
										{session.code}
									</Link>
								</th>
								<td className="px-4 py-4">
									<Badge
										tone={session.status === 'finished' ? 'muted' : 'neutral'}>{statusLabel(session.status)}</Badge>
								</td>
								<td className="whitespace-nowrap px-4 py-4 text-sm">
									<time
										dateTime={session.createdAt}>										{new Intl.DateTimeFormat('en', {
											dateStyle: 'medium',
											timeStyle: 'short',
										}).format(new Date(session.createdAt))}</time>
								</td>
								<td className="px-4 py-4">
									<Link href={`/host/sessions/${session.id}`}
									      className="inline-flex min-h-11 items-center font-semibold text-bone underline underline-offset-4 hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">
										Open session
									</Link>
								</td>
							</tr>
						))}
						</tbody>
					</table>
				</div>
			)}
		</main>
	);
}
