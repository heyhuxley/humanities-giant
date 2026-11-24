import { notFound } from 'next/navigation';
import { requireHost } from '@/lib/auth/require-host';
import { createClient } from '@/lib/supabase/server';
import { SetContestantForm, StartSessionForm } from './session-controls';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type SessionQuestion = {
  position: number;
  questions: { text: string } | { text: string }[] | null;
};

type SessionRecord = {
  id: string;
  code: string;
  public_state: unknown;
  current_question: unknown;
  session_questions: SessionQuestion[] | null;
};

type Participant = {
  id: string;
  display_name: string;
  role: 'contestant' | 'audience';
};

type DisplayQuestion = {
  text: string;
  options: [string, string, string, string];
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
    && 'current_question' in value
    && (Array.isArray(value.session_questions) || value.session_questions === null)
    && (value.session_questions === null || value.session_questions.every(isSessionQuestion));
}

function isParticipant(value: unknown): value is Participant {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.display_name === 'string'
    && (value.role === 'contestant' || value.role === 'audience');
}

function displayQuestion(value: unknown): DisplayQuestion | null {
  if (!isRecord(value) || typeof value.text !== 'string' || !Array.isArray(value.options)) {
    return null;
  }
  const { options } = value;
  if (
    options.length !== 4 ||
    options.some((option) => typeof option !== 'string')
  ) {
    return null;
  }
  return {
    text: value.text,
    options: [options[0], options[1], options[2], options[3]],
  };
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
    .select('id, code, public_state, current_question, session_questions!session_questions_session_id_fkey(position, questions(text))')
    .eq('id', id)
    .eq('host_id', hostId)
    .maybeSingle();
  if (error) throw new Error('Unable to load this session.');
  if (!data) notFound();
  const session: unknown = data;
  if (!isSessionRecord(session)) throw new Error('Unable to load this session.');

  const { data: participantData, error: participantError } = await supabase
    .from('participants')
    .select('id, display_name, role')
    .eq('session_id', id)
    .order('display_name');
  if (participantError) throw new Error('Unable to load this session.');
  const rawParticipants: unknown = participantData;
  if (!Array.isArray(rawParticipants) || !rawParticipants.every(isParticipant)) {
    throw new Error('Unable to load this session.');
  }
  const participants: Participant[] = rawParticipants;
  const orderedQuestions = [...(session.session_questions ?? [])].sort((first, second) => first.position - second.position);
  const status = readStatus(session.public_state);
  const question = displayQuestion(session.current_question);
  const hasContestant = participants.some((participant) => participant.role === 'contestant');
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Session created</h1>
        <p className="text-sm text-gray-600">Join code</p>
        <p className="text-5xl font-bold tracking-widest" aria-label={`Join code ${session.code}`}>{session.code}</p>
      </header>
      <p>Status: <span className="font-medium">{status}</span></p>
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
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Players</h2>
        <ul className="space-y-2">
          {participants.map((participant) => (
            <li key={participant.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
              <span>
                {participant.display_name}
                {participant.role === 'contestant' ? <span className="ml-2 font-semibold">(Contestant)</span> : null}
              </span>
              {status === 'waiting' && participant.role === 'audience' ? (
                <SetContestantForm sessionId={session.id} participantId={participant.id} />
              ) : null}
            </li>
          ))}
          {participants.length === 0 ? <li className="text-gray-600">No players have joined yet.</li> : null}
        </ul>
        <p className="text-sm text-gray-600">Reload the page to see new players.</p>
        {status === 'waiting' ? (
          <StartSessionForm sessionId={session.id} hasContestant={hasContestant} />
        ) : (
          <div className="space-y-2">
            {question ? (
              <>
                <p>{question.text}</p>
                <ol className="list-inside list-decimal space-y-1">
                  {question.options.map((option, index) => <li key={index}>{option}</li>)}
                </ol>
              </>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
