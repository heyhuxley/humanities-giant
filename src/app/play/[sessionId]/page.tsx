import { notFound } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUserId(claims: unknown): string | null {
  if (!isRecord(claims) || typeof claims.sub !== 'string' || claims.sub.length === 0) return null;
  return claims.sub;
}

export default async function PlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!UUID_PATTERN.test(sessionId)) notFound();

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    notFound();
  }

  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error) userId = readUserId(data?.claims);
  } catch {
    notFound();
  }
  if (userId === null) notFound();

  let queryResult: { session: unknown; participant: unknown; failed: boolean } | null = null;
  try {
    const [sessionResult, participantResult] = await Promise.all([
      supabase.from('sessions').select('id, public_state').eq('id', sessionId).maybeSingle(),
      supabase.from('participants').select('display_name').eq('session_id', sessionId).eq('user_id', userId).maybeSingle(),
    ]);
    queryResult = {
      session: sessionResult.data,
      participant: participantResult.data,
      failed: Boolean(sessionResult.error || participantResult.error),
    };
  } catch {
    notFound();
  }

  if (!queryResult || queryResult.failed || queryResult.session === null || queryResult.participant === null) notFound();

  const session: unknown = queryResult.session;
  const participant: unknown = queryResult.participant;
  if (!isRecord(session) || !isRecord(participant) || typeof participant.display_name !== 'string') notFound();
  if (!isRecord(session.public_state) || typeof session.public_state.status !== 'string') notFound();

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">You joined the game</h1>
      <p>Playing as <span className="font-semibold">{participant.display_name}</span></p>
      <p>Status: <span className="font-medium">{session.public_state.status}</span></p>
      <p className="rounded-lg bg-stone-100 p-4">You&apos;re in. The waiting room comes next.</p>
    </main>
  );
}
