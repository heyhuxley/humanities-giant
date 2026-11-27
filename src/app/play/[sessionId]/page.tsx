import { notFound } from 'next/navigation';
import { readCurrentQuestion, readPublicState } from '../../../lib/sessions/read-public-state';
import { buildLadderRows, formatNaira } from '../../../lib/sessions/ladder-view';
import { createClient } from '../../../lib/supabase/server';
import { optionAvailability } from '../../../lib/sessions/lifeline-view';
import { optionStates } from '../../../lib/sessions/reveal-view';
import { LiveSessionRefresh } from '../../../components/live-session-refresh';
import { Card } from '../../../components/stage/card';
import { Spotlight } from '../../../components/stage/spotlight';
import { StageMotion } from '../../../components/motion/stage-motion';
import type { MotionSnapshot, MotionStatus, SlabView } from '../../../components/motion/motion-plan';
import { CountdownTimer } from '../../../components/countdown-timer';
import { FinalResult } from '../../../components/final-result';
import { MoneyLadder } from '../../../components/money-ladder';
import { ContestantPanel } from './contestant-panel';
import { AudiencePanel } from './audience-panel';
import {
  castVoteAction,
  submitAnswerAction,
  useLifelineAction,
  walkAwayAction,
} from './actions';
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
  const ladderRows = publicState.position === null
    ? []
    : buildLadderRows({
      position: publicState.position,
      status: publicState.status,
      lastResult: publicState.lastResult,
    });
  const walkAwayAmount = ladderRows.find((row) => row.position === publicState.position)?.amount
    ?? null;
  const showQuestionScreen =
    (publicState.status === 'question_active' ||
      publicState.status === 'locked' ||
      publicState.status === 'revealed' ||
      publicState.status === 'finished') &&
    currentQuestion !== null;
  const isAnsweringView =
    (publicState.status === 'question_active' || publicState.status === 'locked') &&
    currentQuestion !== null;
  const playerPanel = showQuestionScreen && currentQuestion ? (
    player.id === publicState.contestantId ? (
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
        walkAwayAction={walkAwayAction}
        walkAwayAmount={walkAwayAmount}
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
        lifelines={publicState.lifelines}
        voteAction={castVoteAction}
      />
    )
  ) : null;
  // eslint-disable-next-line react-hooks/purity
  const serverNowMs = Date.now();
  const motionStatus: MotionStatus =
    publicState.status === 'waiting' ||
    publicState.status === 'question_active' ||
    publicState.status === 'locked' ||
    publicState.status === 'revealed' ||
    publicState.status === 'finished'
      ? publicState.status
      : 'unknown';
  const motionSlabs: [SlabView, SlabView, SlabView, SlabView] =
    showQuestionScreen
      ? (() => {
          const states = optionStates({
            lockedAnswer: publicState.lockedAnswer,
            correctIndex: publicState.correctIndex,
            revealed:
              publicState.status === 'revealed' ||
              publicState.status === 'finished',
          });
          const available = optionAvailability(publicState.lifelines.fiftyFifty.removed);
          const mapSlab = (
            index: 0 | 1 | 2 | 3,
          ): SlabView => {
            if (states[index].state === 'neutral') {
              return available[index] ? 'neutral' : 'removed';
            }
            return states[index].state;
          };
          return [mapSlab(0), mapSlab(1), mapSlab(2), mapSlab(3)];
        })()
      : ['neutral', 'neutral', 'neutral', 'neutral'];
  const motionSnapshot: MotionSnapshot = {
    position: publicState.position ?? 0,
    status: motionStatus,
    slabs: motionSlabs,
    lifelineResults: {
      fiftyFifty: publicState.lifelines.fiftyFifty.removed !== null,
      phone: publicState.lifelines.phone.hint !== null,
      audience:
        publicState.lifelines.audience.percentages !== null ||
        publicState.lifelines.audience.notEnoughVotes,
    },
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      className={isAnsweringView
        ? 'film-grain mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8'
        : 'film-grain mx-auto min-h-screen w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12'}
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
        <h1 className={isAnsweringView
          ? 'font-display text-3xl font-semibold text-bone text-pretty'
          : 'font-display text-3xl font-semibold text-bone text-pretty sm:text-4xl'}>
          Who Wants to Be a Humanities Giant
        </h1>
        <LiveSessionRefresh sessionId={sessionId} />
      </header>

      <section className={isAnsweringView
        ? 'flex flex-wrap items-center justify-between gap-2 text-bone-muted'
        : isWaiting
          ? 'space-y-4'
          : 'flex flex-wrap items-center justify-between gap-3 text-bone-muted'}>
        {isWaiting ? (
          <div className="relative w-full overflow-hidden border-y border-rule px-4 py-8 text-center sm:py-10">
            <Spotlight>
              <div className="space-y-3">
                <h2 className="font-display text-4xl font-semibold text-bone sm:text-5xl">
                  You&apos;re in
                </h2>
                <p className="text-lg text-bone-muted">
                  Playing as{' '}
                  <span className="font-semibold text-bone">{player.display_name}</span>
                </p>
              </div>
            </Spotlight>
          </div>
        ) : (
          <p>
            Playing as <span className="font-semibold">{player.display_name}</span>
          </p>
        )}
        {player.role === 'contestant' ? (
          <p className="flex min-h-11 items-center gap-2 border border-brass/60 bg-slab px-3 py-2 font-semibold text-brass">
            <svg
              aria-hidden="true"
              className="size-5 shrink-0"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="10" cy="6.5" r="3" />
              <path d="M4.5 17v-1.25a5.5 5.5 0 0 1 11 0V17z" />
            </svg>
            <span>You are in the hot seat</span>
          </p>
        ) : null}
      </section>

      {isWaiting ? (
        <section className="space-y-5">
          <p className="font-display text-xl text-bone">
            Waiting for the host to start
          </p>
          <Card heading="Players" headingLevel={3}>
            <ul className="flex flex-col gap-2">
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 border border-rule bg-ink px-3 py-2"
                >
                  <span className="min-w-0 break-words text-base text-bone">
                    {participant.display_name}
                  </span>
                  {participant.role === 'contestant' ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brass">
                      <svg
                        aria-hidden="true"
                        className="size-4 shrink-0"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      >
                        <path d="m10 3 1.8 4 4.2.5-3.1 2.9.8 4.2-3.7-2.1-3.7 2.1.8-4.2L4 7.5 8.2 7z" />
                      </svg>
                      <span>Contestant</span>
                    </span>
                  ) : null}
                  {participant.id === player.id ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-bone-muted">
                      <svg
                        aria-hidden="true"
                        className="size-4 shrink-0"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      >
                        <path d="m4 10 4 4 8-8" />
                      </svg>
                      <span>you</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : (
        <StageMotion snapshot={motionSnapshot}>
          <section className={isAnsweringView ? 'space-y-6' : 'space-y-3'}>
            <h2 className="text-lg font-semibold">Status: {statusLabel(publicState.status)}</h2>
            {isAnsweringView ? (
              <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0 space-y-5">
                  <header className="grid gap-3 border-y border-rule bg-slab px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1.5fr)_auto] sm:items-center">
                    {publicState.position !== null ? (
                      <p className="font-body text-sm font-semibold uppercase tracking-widest text-bone-muted">
                        Question {publicState.position}
                      </p>
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
                    {publicState.amountAtStake !== null ? (
                      <p className="font-display text-xl font-semibold tabular-nums text-brass">
                        {formatNaira(publicState.amountAtStake)}
                      </p>
                    ) : null}
                  </header>
                  {playerPanel}
                </div>
                {publicState.position !== null && publicState.position >= 1 ? (
                  <MoneyLadder
                    position={publicState.position}
                    status={publicState.status}
                    lastResult={publicState.lastResult}
                  />
                ) : null}
              </div>
            ) : (
              <>
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
                {publicState.status === 'finished' ? null : playerPanel}
                {!showQuestionScreen && currentQuestion ? (
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
              </>
            )}
            {(publicState.status === 'question_active' ||
              publicState.status === 'locked') &&
            !showQuestionScreen &&
            currentQuestion === null ? (
              <p>Question unavailable</p>
            ) : null}
            {publicState.status === 'finished' ? (
              <FinalResult
                winnings={publicState.winnings}
                finishReason={publicState.finishReason}
                position={publicState.position}
                lastResult={publicState.lastResult}
                correctIndex={publicState.correctIndex}
                contestantName={participants.find((participant) =>
                  participant.id === publicState.contestantId,
                )?.display_name ?? null}
                lifelinesUsed={{
                  fiftyFifty: publicState.lifelines.fiftyFifty.used,
                  phone: publicState.lifelines.phone.used,
                  audience: publicState.lifelines.audience.used,
                }}
                question={currentQuestion}
              />
            ) : null}
          </section>
        </StageMotion>
      )}
    </main>
  );
}
