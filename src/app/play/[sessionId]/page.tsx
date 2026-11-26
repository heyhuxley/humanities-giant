import { notFound } from 'next/navigation';
import { readCurrentQuestion, readPublicState } from '../../../lib/sessions/read-public-state';
import { describeFinishReason } from '../../../lib/sessions/reveal-view';
import { formatNaira } from '../../../lib/sessions/ladder-view';
import { createClient } from '../../../lib/supabase/server';
import { LiveSessionRefresh } from '../../../components/live-session-refresh';
import { CountdownTimer } from '../../../components/countdown-timer';
import { MoneyLadder } from '../../../components/money-ladder';
import { ContestantPanel } from './contestant-panel';
import { AudiencePanel } from './audience-panel';
import { castVoteAction, submitAnswerAction, useLifelineAction } from './actions';
import { knockAction } from '../../knock/actions';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type Participant = {
  id: string;
  display_name: string;
  role: 'contestant' | 'audience';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUserId(claims: unknown): string | null {
  if (!isRecord(claims) || typeof claims.sub !== 'string' || claims.sub.length === 0) return null;
  return claims.sub;
}

function readParticipant(value: unknown): Participant | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.display_name !== 'string' ||
    (value.role !== 'contestant' && value.role !== 'audience')
  ) {
    return null;
  }
  return { id: value.id, display_name: value.display_name, role: value.role };
}

function statusLabel(status: string): string {
  const words = status.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
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

  let queryResult:
    | { session: unknown; participant: unknown; roster: unknown; failed: boolean }
    | null = null;
  try {
    const [sessionResult, participantResult, rosterResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, public_state, current_question')
        .eq('id', sessionId)
        .maybeSingle(),
      supabase
        .from('participants')
        .select('id, display_name, role')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('participants')
        .select('id, display_name, role')
        .eq('session_id', sessionId)
        .order('display_name')
        .order('id'),
    ]);
    queryResult = {
      session: sessionResult.data,
      participant: participantResult.data,
      roster: rosterResult.data,
      failed: Boolean(sessionResult.error || participantResult.error || rosterResult.error),
    };
  } catch {
    notFound();
  }

  if (
    !queryResult ||
    queryResult.failed ||
    !isRecord(queryResult.session) ||
    queryResult.session.id !== sessionId ||
    !Array.isArray(queryResult.roster)
  ) {
    notFound();
  }

  const player = readParticipant(queryResult.participant);
  const roster = queryResult.roster.map(readParticipant);
  const publicState = readPublicState(queryResult.session.public_state);
  const currentQuestion = readCurrentQuestion(queryResult.session.current_question);
  if (!player || !publicState || roster.some((entry) => entry === null)) notFound();

  const participants = roster.filter((entry): entry is Participant => entry !== null);
  const isWaiting = publicState.status === 'waiting';
  const showQuestionScreen =
    (publicState.status === 'question_active' ||
      publicState.status === 'locked' ||
      publicState.status === 'revealed' ||
      publicState.status === 'finished') &&
    currentQuestion !== null;
  // eslint-disable-next-line react-hooks/purity
  const serverNowMs = Date.now();

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Who Wants to Be a Humanities Giant</h1>
        <LiveSessionRefresh sessionId={sessionId} />
      </header>

      <section className="space-y-2">
        <p>
          Playing as <span className="font-semibold">{player.display_name}</span>
        </p>
        {player.role === 'contestant' ? (
          <p className="rounded bg-amber-100 p-3 font-semibold">You are in the hot seat</p>
        ) : null}
      </section>

      {isWaiting ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Waiting for the host to start</h2>
          <h3 className="font-medium">Players</h3>
          <ul className="space-y-2">
            {participants.map((participant) => (
              <li key={participant.id}>
                <span>{participant.display_name}</span>
                {participant.role === 'contestant' ? <span> (Contestant)</span> : null}
                {participant.id === player.id ? <span> (you)</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Status: {statusLabel(publicState.status)}</h2>
          {publicState.position !== null && publicState.position >= 1 ? (
            <MoneyLadder
              position={publicState.position}
              status={publicState.status}
              lastResult={publicState.lastResult}
            />
          ) : null}
          {currentQuestion ? (
            <CountdownTimer
              endsAtMs={publicState.questionEndsAt}
              serverNowMs={serverNowMs}
              active={publicState.status === 'question_active'}
              sessionId={sessionId}
              knockAction={knockAction}
            />
          ) : null}
          {showQuestionScreen && currentQuestion ? (
            <>
              {player.id === publicState.contestantId ? (
                <ContestantPanel
                  key={publicState.position}
                  sessionId={sessionId}
                  position={publicState.position}
                  amountAtStake={publicState.amountAtStake}
                  question={currentQuestion}
                  lockedAnswer={publicState.lockedAnswer}
                  correctIndex={publicState.correctIndex}
                  lastResult={publicState.lastResult}
                  status={publicState.status}
                  open={publicState.status === 'question_active'}
                  lifelines={publicState.lifelines}
                  submitAction={submitAnswerAction}
                  lifelineAction={useLifelineAction}
                />
              ) : (
                <AudiencePanel
                  key={publicState.position}
                  sessionId={sessionId}
                  position={publicState.position}
                  amountAtStake={publicState.amountAtStake}
                  question={currentQuestion}
                  lockedAnswer={publicState.lockedAnswer}
                  correctIndex={publicState.correctIndex}
                  lastResult={publicState.lastResult}
                  status={publicState.status}
                  open={publicState.status === 'question_active'}
                  voteAction={castVoteAction}
                />
              )}
            </>
          ) : currentQuestion ? (
            <div className="space-y-2">
              <p>{currentQuestion.text}</p>
              <ol className="list-inside list-decimal space-y-1">
                {currentQuestion.options.map((option, index) => <li key={index}>{option}</li>)}
              </ol>
              {publicState.status === 'revealed' ? (
                <p>Waiting for the host to continue</p>
              ) : null}
            </div>
          ) : null}
          {(publicState.status === 'question_active' ||
            publicState.status === 'locked') &&
          !showQuestionScreen &&
          currentQuestion === null ? (
            <p>Question unavailable</p>
          ) : null}
          {publicState.status === 'finished' ? (
            <div className="space-y-1">
              {publicState.winnings !== null ? (
                <p>Winnings: {formatNaira(publicState.winnings)}</p>
              ) : null}
              <p>Finish reason: {describeFinishReason(publicState.finishReason)}</p>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
