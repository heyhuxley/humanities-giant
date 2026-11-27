'use client';

import {useActionState, useState} from 'react';
import {QUESTION_SUBJECTS} from '../../../lib/questions/validate';
import {createSessionAction, type CreateSessionActionState} from './actions';
import {Badge} from '../../../components/stage/badge';
import {Button} from '../../../components/stage/button';
import {Card} from '../../../components/stage/card';
import {Field} from '../../../components/stage/field';
import {InlineAlert} from '../../../components/stage/inline-alert';

export type SessionPickerQuestion = {
	id: string;
	subject: string;
	difficulty: string;
	text: string;
};

const initialActionState: CreateSessionActionState = {error: null};

export function SessionPicker({questions}: { questions: SessionPickerQuestion[] }) {
	const [subject, setSubject] = useState('all');
	const [search, setSearch] = useState('');
	const [lineup, setLineup] = useState<SessionPickerQuestion[]>([]);
	const [actionState, formAction, pending] = useActionState(createSessionAction, initialActionState);
	const selectedIds = new Set(lineup.map((question) => question.id));
	const normalizedSearch = search.trim().toLocaleLowerCase();
	const visibleQuestions = questions.filter((question) => {
		const matchesSubject = subject === 'all' || question.subject === subject;
		const matchesSearch = question.text.toLocaleLowerCase().includes(normalizedSearch);
		return matchesSubject && matchesSearch;
	});
	
	function addQuestion(question: SessionPickerQuestion) {
		if (lineup.length >= 15 || selectedIds.has(question.id)) return;
		setLineup((current) => [...current, question]);
	}
	
	function removeQuestion(questionId: string) {
		setLineup((current) => current.filter((question) => question.id !== questionId));
	}
	
	function moveQuestion(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= lineup.length) return;
		setLineup((current) => {
			const reordered = [...current];
			[reordered[index], reordered[target]] = [reordered[target], reordered[index]];
			return reordered;
		});
	}
	
	return (
		<form action={formAction} className="space-y-6">
			<input type="hidden" name="questionIds" value={lineup.map((question) => question.id).join(',')}/>
			
			<div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
				<section aria-labelledby="question-search-heading" className="min-w-0">
					<Card>
						<h2 id="question-search-heading" className="font-display text-xl font-semibold text-bone">Choose
							questions</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label htmlFor="question-subject" className="block text-sm font-semibold">Filter by
									subject</label>
								<select id="question-subject" value={subject}
								        onChange={(event) => setSubject(event.target.value)}
								        className="min-h-12 w-full rounded-sm border border-rule bg-ink px-3 py-2 text-base text-bone outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember">
									<option value="all">All subjects</option>
									{QUESTION_SUBJECTS.map((item) => <option key={item} value={item}>{item}</option>)}
								</select>
							</div>
							<Field id="question-search" type="search" value={search}
							       onChange={(event) => setSearch(event.target.value)} label="Search question text"/>
						</div>
						
						<ul aria-label="Available questions"
						    className="max-h-96 space-y-2 overflow-y-auto overscroll-contain pr-1">
							{visibleQuestions.map((question) => {
								const alreadySelected = selectedIds.has(question.id);
								return (
									<li key={question.id}
									    className="flex min-w-0 items-start justify-between gap-3 rounded-sm border border-rule bg-ink p-3">
										<div className="min-w-0 space-y-2">
											<div className="flex flex-wrap gap-2">
												<Badge>{question.subject}</Badge>
												<Badge tone="muted">{question.difficulty}</Badge>
											</div>
											<p className="break-words">{question.text}</p>
										</div>
										<Button
											type="button"
											onClick={() => addQuestion(question)}
											disabled={alreadySelected || lineup.length >= 15}
											aria-label={`Add question: ${question.text}`}
											variant="secondary"
											className="shrink-0 px-3"
										>
											{alreadySelected ? 'Added' : 'Add'}
										</Button>
									</li>
								);
							})}
							{visibleQuestions.length === 0 ?
								<li className="p-3 text-bone-muted">No questions match these filters.</li> : null}
						</ul>
					</Card>
				</section>
				
				<section aria-labelledby="lineup-heading" className="min-w-0">
					<Card>
						<h2 id="lineup-heading" className="font-display text-xl font-semibold text-bone">Session
							lineup</h2>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<p aria-live="polite" className="font-semibold tabular-nums text-bone">{lineup.length} / 15
								selected</p>
							<Badge
								tone={lineup.length === 15 ? 'positive' : 'neutral'}>{lineup.length === 15 ? 'Ready' : 'Selection in progress'}</Badge>
						</div>
						<ol className="max-h-96 space-y-2 overflow-y-auto overscroll-contain pr-1">
							{lineup.map((question, index) => (
								<li key={question.id}
								    className="grid min-w-0 gap-3 rounded-sm border border-rule bg-ink p-3">
									<div className="flex min-w-0 items-start gap-3">
										<span
											className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-rule font-display font-semibold tabular-nums">{index + 1}</span>
										<span className="min-w-0 flex-1 break-words">{question.text}</span>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button type="button" onClick={() => moveQuestion(index, -1)}
										        disabled={index === 0} aria-label={`Move question ${index + 1} up`}
										        variant="secondary" className="px-3">Move up</Button>
										<Button type="button" onClick={() => moveQuestion(index, 1)}
										        disabled={index === lineup.length - 1}
										        aria-label={`Move question ${index + 1} down`} variant="secondary"
										        className="px-3">Move down</Button>
										<Button type="button" onClick={() => removeQuestion(question.id)}
										        aria-label={`Remove question ${index + 1}`} variant="danger"
										        className="px-3">Remove</Button>
									</div>
								</li>
							))}
						</ol>
						{lineup.length === 0 ?
							<p className="rounded-sm border border-dashed border-rule p-4 text-bone-muted">Add questions
								to set their order.</p> : null}
					</Card>
				</section>
			</div>
			
			{actionState.error ? <InlineAlert>{actionState.error}</InlineAlert> : null}
			<div className="space-y-2 border-t border-rule pt-5">
				<Button type="submit" disabled={lineup.length !== 15 || pending} size="large">
					{pending ? 'Creating session…' : 'Create session'}
				</Button>
				{lineup.length !== 15 ?
					<p className="text-sm text-bone-muted">Select exactly 15 questions to create a session.</p> : null}
			</div>
		</form>
	);
}
