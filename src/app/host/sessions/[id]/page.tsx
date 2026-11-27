import {notFound} from 'next/navigation';
import {requireHost} from '@/lib/auth/require-host';
import {createClient} from '@/lib/supabase/server';
import {readCurrentQuestion, readPublicState} from '@/lib/sessions/read-public-state';
import {knockAction} from '../../../knock/actions';
import {CountdownTimer} from '../../../../components/countdown-timer';
import {LiveSessionRefresh} from '../../../../components/live-session-refresh';
import {FinalResult} from '../../../../components/final-result';
import {Badge} from '../../../../components/stage/badge';
import {Card} from '../../../../components/stage/card';
import {PageHeader} from '../../../../components/stage/page-header';
import {
	EndSessionControl,
	NextControl,
	RevealControl,
	SetContestantForm,
	StartSessionForm,
} from './session-controls';

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

function questionText(question: SessionQuestion['questions']): string {
	const row = Array.isArray(question) ? question[0] : question;
	return row && typeof row.text === 'string' ? row.text : 'Question unavailable.';
}

export default async function HostSessionPage({params}: Readonly<{ params: Promise<{ id: string }> }>) {
	const hostId = await requireHost();
	const {id} = await params;
	if (!UUID_PATTERN.test(id)) notFound();
	
	const supabase = await createClient();
	const {data, error} = await supabase
		.from('sessions')
		.select('id, code, public_state, current_question, session_questions!session_questions_session_id_fkey(position, questions(text))')
		.eq('id', id)
		.eq('host_id', hostId)
		.maybeSingle();
	if (error) throw new Error('Unable to load this session.');
	if (!data) notFound();
	const session: unknown = data;
	if (!isSessionRecord(session)) throw new Error('Unable to load this session.');
	
	const {data: participantData, error: participantError} = await supabase
		.from('participants')
		.select('id, display_name, role')
		.eq('session_id', id)
		.order('display_name')
		.order('id');
	if (participantError) throw new Error('Unable to load this session.');
	const rawParticipants: unknown = participantData;
	if (!Array.isArray(rawParticipants) || !rawParticipants.every(isParticipant)) {
		throw new Error('Unable to load this session.');
	}
	const participants: Participant[] = rawParticipants;
	const orderedQuestions = [...(session.session_questions ?? [])].sort((first, second) => first.position - second.position);
	const safeState = readPublicState(session.public_state);
	const status = safeState?.status ?? 'unknown';
	const position = safeState?.position ?? null;
	const lockedAnswer = safeState?.lockedAnswer ?? null;
	const questionEndsAt = safeState?.questionEndsAt ?? null;
	// The host server render supplies the clock sample used by the client countdown.
	// eslint-disable-next-line react-hooks/purity
	const serverNowMs = Date.now();
	const question = readCurrentQuestion(session.current_question);
	const hasContestant = participants.some((participant) => participant.role === 'contestant');
	const statusMessage = status === 'question_active'
		? 'Waiting for the contestant to answer'
		: status === 'locked'
			? lockedAnswer === null
				? 'Time ran out with no answer'
				: `Contestant locked in option ${String.fromCharCode(65 + lockedAnswer)}`
			: status === 'revealed'
				? 'Answer revealed'
				: status === 'finished'
					? 'Game finished'
					: null;
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6 sm:py-12">
			<PageHeader title="Host session"/>
			<Card className="flex flex-wrap items-end justify-between gap-5">
				<div className="min-w-0">
					<p className="text-sm font-semibold uppercase tracking-wide text-bone-muted">Join code</p>
					<p className="break-all font-display text-5xl font-semibold tracking-wide text-bone sm:text-6xl"
					   aria-label={`Join code ${session.code}`}>{session.code}</p>
				</div>
				<LiveSessionRefresh sessionId={session.id}/>
			</Card>
			<Card className="flex flex-wrap items-center justify-between gap-4">
				<div className="space-y-1">
					{statusMessage
						? <p role="status" className="font-display text-2xl font-semibold text-bone">{statusMessage}</p>
						:
						<p className="font-display text-2xl font-semibold text-bone">{status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')}</p>}
					<p className="text-bone-muted">{participants.length} players</p>
				</div>
				<Badge tone={status === 'finished' ? 'muted' : 'neutral'}>
					{status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')}
				</Badge>
			</Card>
			{status === 'question_active' ? (
				<Card>
					<h2 className="font-display text-lg font-semibold">Time remaining</h2>
					<CountdownTimer
						active={status === 'question_active'}
						endsAtMs={questionEndsAt}
						serverNowMs={serverNowMs}
						sessionId={session.id}
						knockAction={knockAction}
					/>
				</Card>
			) : null}
			<section aria-labelledby="session-questions-heading">
				<Card>
					<h2 id="session-questions-heading" className="font-display text-xl font-semibold">Session
						questions</h2>
					<ol className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
						{orderedQuestions.map((item) => (
							<li key={`${item.position}`}
							    className="flex min-w-0 gap-3 rounded-sm border border-rule bg-ink p-3">
								<span
									className="shrink-0 font-display font-semibold tabular-nums text-bone-muted">{item.position}.</span>
								<span className="min-w-0 break-words">{questionText(item.questions)}</span>
							</li>
						))}
					</ol>
				</Card>
			</section>
			<section aria-labelledby="session-players-heading">
				<Card>
					<h2 id="session-players-heading" className="font-display text-xl font-semibold">Player roster</h2>
					<ul className="space-y-2">
						{participants.map((participant) => (
							<li key={participant.id}
							    className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-sm border border-rule bg-ink p-3">
								<div className="flex min-w-0 items-center gap-3">
									{participant.role === 'contestant' ? (
										<>
											<svg aria-hidden="true" className="size-5 shrink-0 text-ember"
											     viewBox="0 0 20 20" fill="none" stroke="currentColor"
											     strokeWidth="1.75">
												<path
													d="m10 2.5 2.2 4.45 4.9.72-3.55 3.46.84 4.88L10 13.7l-4.39 2.31.84-4.88L2.9 7.67l4.9-.72L10 2.5Z"/>
											</svg>
											<span className="min-w-0 break-words">{participant.display_name} <span
												className="font-semibold text-bone-muted">(Contestant)</span></span>
										</>
									) : <span className="min-w-0 break-words">{participant.display_name}</span>}
								</div>
								{status === 'waiting' && participant.role === 'audience' ?
									<SetContestantForm sessionId={session.id} participantId={participant.id}/> : null}
							</li>
						))}
						{participants.length === 0 ?
							<li className="rounded-sm border border-dashed border-rule p-4 text-bone-muted">No players
								have joined yet.</li> : null}
					</ul>
				</Card>
			</section>
			{question && status !== 'waiting' ? (
				<section aria-labelledby="current-question-heading">
					<Card>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2 id="current-question-heading" className="font-display text-xl font-semibold">Current
								question</h2>
							{position === null ? null : <Badge>Question {position}</Badge>}
						</div>
						<p className="break-words text-pretty">{question.text}</p>
						<ol className="grid gap-2 sm:grid-cols-2">
							{question.options.map((option, index) => (
								<li key={index} className="min-w-0 rounded-sm border border-rule bg-ink p-3">
									<span
										className="mr-2 font-display font-semibold">{String.fromCharCode(65 + index)}.</span>
									<span className="break-words">{option}</span>
								</li>
							))}
						</ol>
					</Card>
				</section>
			) : null}
			{status !== 'finished' ? (
				<section aria-labelledby="host-action-heading">
					<Card>
						<h2 id="host-action-heading" className="font-display text-xl font-semibold">Host action</h2>
						{status === 'waiting' ?
							<StartSessionForm sessionId={session.id} hasContestant={hasContestant}/> : null}
						{status === 'locked' ? <RevealControl sessionId={session.id}/> : null}
						{status === 'revealed' ? (
							<div className="space-y-3">
								<p className="text-bone-muted">The contestant can walk away until you press Next.</p>
								<NextControl sessionId={session.id}/>
							</div>
						) : null}
					</Card>
				</section>
			) : null}
			{safeState?.status === 'finished' ? (
				<FinalResult
					winnings={safeState.winnings}
					finishReason={safeState.finishReason}
					position={safeState.position}
					lastResult={safeState.lastResult}
					correctIndex={safeState.correctIndex}
					contestantName={participants.find((participant) =>
						participant.id === safeState.contestantId,
					)?.display_name ?? null}
					lifelinesUsed={{
						fiftyFifty: safeState.lifelines.fiftyFifty.used,
						phone: safeState.lifelines.phone.used,
						audience: safeState.lifelines.audience.used,
					}}
					question={question}
				/>
			) : null}
			{safeState?.status !== 'finished' ? (
				<section aria-labelledby="end-session-heading"
				         className="rounded-sm border border-rose/50 bg-rose/5 p-4 sm:p-5">
					<h2 id="end-session-heading" className="mb-3 font-display text-lg font-semibold">End session</h2>
					<EndSessionControl sessionId={session.id}/>
				</section>
			) : null}
		</main>
	);
}
