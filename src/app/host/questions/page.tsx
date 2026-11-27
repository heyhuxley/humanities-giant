import Link from 'next/link';
import {requireHost} from '../../../lib/auth/require-host';
import {QUESTION_DIFFICULTIES, QUESTION_SUBJECTS} from '../../../lib/questions/validate';
import {createClient} from '../../../lib/supabase/server';
import {Badge} from '../../../components/stage/badge';
import {Button} from '../../../components/stage/button';
import {Card} from '../../../components/stage/card';
import {InlineAlert} from '../../../components/stage/inline-alert';
import {PageHeader} from '../../../components/stage/page-header';
import {DeleteQuestionForm} from './delete-question-form';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type QuestionRow = {
	id: string;
	subject: string;
	difficulty: string;
	text: string;
	options: string[];
	question_answers: { correct_index: number } | { correct_index: number }[] | null;
};

function oneString(value: string | string[] | undefined): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

export default async function QuestionsPage({searchParams}: { searchParams: SearchParams }) {
	const hostId = await requireHost();
	const params = await searchParams;
	const subjectValue = oneString(params.subject);
	const difficultyValue = oneString(params.difficulty);
	const subject = QUESTION_SUBJECTS.find((item) => item === subjectValue);
	const difficulty = QUESTION_DIFFICULTIES.find((item) => item === difficultyValue);
	const rawPage = oneString(params.page);
	const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
	const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
	
	const supabase = await createClient();
	let query = supabase
		.from('questions')
		.select('id, subject, difficulty, text, options, created_at, question_answers(correct_index)', {count: 'exact'})
		.eq('created_by', hostId);
	if (subject) query = query.eq('subject', subject);
	if (difficulty) query = query.eq('difficulty', difficulty);
	const start = (page - 1) * 20;
	const {data, count, error} = await query
		.order('created_at', {ascending: false})
		.order('id', {ascending: false})
		.range(start, start + 19);
	const rows = error ? [] : (data ?? []) as unknown as QuestionRow[];
	const totalPages = Math.max(1, Math.ceil((count ?? 0) / 20));
	const notice = oneString(params.notice);
	
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 outline-none sm:px-6 sm:py-12">
			<PageHeader title="Question bank"/>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<p className="max-w-prose text-bone-muted">Manage your questions and answers.</p>
				<Link href="/host/questions/new"><Button>Create question</Button></Link>
			</div>
			{notice === 'used' ?
				<InlineAlert>This question is used in a session and can&apos;t be deleted.</InlineAlert> : null}
			{notice === 'failed' ? <InlineAlert>Something went wrong. Try again.</InlineAlert> : null}
			{notice === 'deleted' ?
				<p role="status" className="rounded-sm border border-jade/50 bg-jade/10 p-4 text-bone">Question
					deleted.</p> : null}
			{error ? <InlineAlert>Questions could not be loaded. Try again.</InlineAlert> : null}
			
			<Card className="p-4 sm:p-5">
				<form method="get" className="flex flex-wrap items-end gap-4">
					<div className="min-w-0 flex-1 space-y-2">
						<label htmlFor="subject-filter" className="block text-sm font-semibold">Subject</label>
						<select id="subject-filter" name="subject" defaultValue={subject ?? ''}
						        className="min-h-12 w-full rounded-sm border border-rule bg-ink px-3 py-2 text-base text-bone outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember">
							<option value="">All subjects</option>
							{QUESTION_SUBJECTS.map((item) => <option key={item} value={item}>{item}</option>)}
						</select>
					</div>
					<div className="min-w-0 flex-1 space-y-2">
						<label htmlFor="difficulty-filter" className="block text-sm font-semibold">Difficulty</label>
						<select id="difficulty-filter" name="difficulty" defaultValue={difficulty ?? ''}
						        className="min-h-12 w-full rounded-sm border border-rule bg-ink px-3 py-2 text-base text-bone outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember">
							<option value="">All difficulties</option>
							{QUESTION_DIFFICULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
						</select>
					</div>
					<Button type="submit" variant="secondary">Filter</Button>
				</form>
			</Card>
			
			{rows.length === 0 ? (
				<Card>
					<h2 className="font-display text-xl font-semibold">No questions found</h2>
					<p className="text-bone-muted">Try another subject or difficulty, or create a question for your
						bank.</p>
					<Link href="/host/questions/new"><Button>Create your first question</Button></Link>
				</Card>
			) : (
				<ul className="space-y-4">
					{rows.map((question) => {
						const answerRelation = Array.isArray(question.question_answers) ? question.question_answers[0] : question.question_answers;
						return (
							<li key={question.id}>
								<article>
									<Card className="space-y-5">
										<div className="flex flex-wrap items-start justify-between gap-4">
											<div className="min-w-0 flex-1 space-y-3">
												<div className="flex flex-wrap gap-2">
													<Badge>{question.subject}</Badge>
													<Badge tone="muted">{question.difficulty}</Badge>
												</div>
												<h2 className="break-words font-semibold text-bone">{question.text}</h2>
											</div>
											<div className="flex shrink-0 items-center gap-3">
												<Link
													className="inline-flex min-h-11 items-center font-semibold text-bone underline underline-offset-4 hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
													href={`/host/questions/${question.id}/edit`}>Edit</Link>
												<DeleteQuestionForm questionId={question.id}/>
											</div>
										</div>
										<ol className="grid gap-2 sm:grid-cols-2">
											{question.options.map((option, index) => {
												const isAnswer = answerRelation?.correct_index === index;
												return (
													<li key={`${question.id}-${index}`}
													    className={`min-w-0 rounded-sm border p-3 ${isAnswer ? 'border-jade/50 bg-jade/10 font-semibold text-bone' : 'border-rule bg-ink text-bone'}`}>
														<span
															className="font-display font-semibold">{String.fromCharCode(65 + index)}.</span>{' '}
														<span className="break-words">{option}</span>
														{isAnswer ? <span
															className="ml-2 inline-flex items-center gap-1 font-semibold"><span
															aria-hidden="true">✓</span><span>Correct</span></span> : null}
													</li>
												);
											})}
										</ol>
									</Card>
								</article>
							</li>
						);
					})}
				</ul>
			)}
			
			{totalPages > 1 ? (
				<nav aria-label="Question pages"
				     className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
					{page > 1 ? <Link href={pageHref(page - 1, subject, difficulty)}
					                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">Previous</Link> :
						<span/>}
					<span className="text-sm text-bone-muted">Page {page} of {totalPages}</span>
					{page < totalPages ? <Link href={pageHref(page + 1, subject, difficulty)}
					                           className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">Next</Link> :
						<span/>}
				</nav>
			) : null}
		</main>
	);
}

function pageHref(page: number, subject?: string, difficulty?: string): string {
	const params = new URLSearchParams({page: String(page)});
	if (subject) params.set('subject', subject);
	if (difficulty) params.set('difficulty', difficulty);
	return `/host/questions?${params.toString()}`;
}
