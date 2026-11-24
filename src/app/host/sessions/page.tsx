import Link from 'next/link';
import { requireHost } from '@/lib/auth/require-host';
import { createClient } from '@/lib/supabase/server';
import { toSessionListItem } from '@/lib/sessions/session-list';

function statusLabel(status: string): string {
  return status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export default async function HostSessionsPage() {
  const hostId = await requireHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, code, public_state, created_at')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
    .order('id')
    .limit(50);
  if (error) throw new Error('Unable to load sessions.');

  const rows: unknown = data;
  const sessions = Array.isArray(rows)
    ? rows.map(toSessionListItem).filter((session) => session !== null)
    : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your sessions</h1>
          <p className="text-gray-600">Review and manage the sessions you have hosted.</p>
        </div>
        <Link href="/host/sessions/new" className="rounded bg-gray-900 px-4 py-2 text-white">
          Create a session
        </Link>
      </header>
      {sessions.length === 0 ? (
        <p className="rounded border p-4 text-gray-600">You haven&apos;t created any sessions yet.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded border p-4 ${
                session.status === 'finished' ? 'text-gray-500' : ''
              }`}
            >
              <div className="space-y-1">
                <p>
                  <span className="font-medium">Code: </span>
                  <Link href={`/host/sessions/${session.id}`} className="underline underline-offset-2">
                    {session.code}
                  </Link>
                </p>
                <p>Status: {statusLabel(session.status)}</p>
                <p className="text-sm">
                  Created <time dateTime={session.createdAt}>{new Date(session.createdAt).toLocaleString()}</time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
