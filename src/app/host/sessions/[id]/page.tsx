import { notFound } from 'next/navigation';
import { requireHost } from '@/lib/auth/require-host';
import { createClient } from '@/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type SessionQuestion = {
  position: number;
  questions: { text: string } | { text: string }[] | null;
};

type SessionRecord = {
  id: string;
  code: string;
  public_state: unknown;
  session_questions: SessionQuestion[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSessionQuestion(value: unknown): value is SessionQuestion {
  return isRecord(value) && typeof value.position === 'number' && 'questions' in value;
}

function isSessionRecord(value: unknown): value is SessionRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.code === 'string'
    && 'public_state' in value
    && (Array.isArray(value.session_questions) || value.session_questions === null)
    && (value.session_questions === null || value.session_questions.every(isSessionQuestion));
}

function readStatus(publicState: unknown): string {
  return isRecord(publicState) && typeof publicState.status === 'string' ? publicState.status : 'unknown';
}

function questionText(question: SessionQuestion['questions']): string {
  const row = Array.isArray(question) ? question[0] : question;
  return row && typeof row.text === 'string' ? row.text : 'Question unavailable.';
}

export default async function HostSessionPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const hostId = await requireHost();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, code, public_state, session_questions!session_questions_session_id_fkey(position, questions(text))')
    .eq('id', id)
    .eq('host_id', hostId)
    .maybeSingle();
  if (error) throw new Error('Unable to load this session.');
  if (!data) notFound();
  const session: unknown = data;
  if (!isSessionRecord(session)) throw new Error('Unable to load this session.');

  const orderedQuestions = [...(session.session_questions ?? [])].sort((first, second) => first.position - second.position);
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Session created</h1>
        <p className="text-sm text-gray-600">Join code</p>
        <p className="text-5xl font-bold tracking-widest" aria-label={`Join code ${session.code}`}>{session.code}</p>
      </header>
      <p>Status: <span className="font-medium">{readStatus(session.public_state)}</span></p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Session questions</h2>
        <ol className="space-y-2">
          {orderedQuestions.map((item) => (
            <li key={`${item.position}`} className="rounded border p-3">
              <span className="mr-2 font-semibold">{item.position}.</span>{questionText(item.questions)}
            </li>
          ))}
        </ol>
      </section>
      <p className="rounded bg-gray-100 p-4">Waiting room comes next.</p>
    </main>
  );
}
