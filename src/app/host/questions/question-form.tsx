'use client';

import {useActionState, useState} from 'react';
import type {QuestionActionState} from './actions';
import {createQuestionAction, updateQuestionAction} from './actions';
import {QUESTION_DIFFICULTIES, QUESTION_SUBJECTS} from '../../../lib/questions/validate';
import {Button} from '../../../components/stage/button';
import {Field} from '../../../components/stage/field';
import {InlineAlert} from '../../../components/stage/inline-alert';

type QuestionFormProps = { initialValues?: QuestionActionState['values']; questionId?: string };
const initialState: QuestionActionState = {
	errors: {},
	values: {
		subject: '',
		difficulty: '',
		text: '',
		option0: '',
		option1: '',
		option2: '',
		option3: '',
		correctIndex: ''
	},
};

export function QuestionForm({initialValues, questionId}: QuestionFormProps) {
	const action = questionId ? updateQuestionAction : createQuestionAction;
	const [state, formAction, pending] = useActionState(action, {
		...initialState,
		values: initialValues ?? initialState.values
	});
	return <QuestionFields key={JSON.stringify(state.values)} state={state} formAction={formAction} pending={pending}
	                       questionId={questionId}/>;
}

type QuestionFieldsProps = {
	state: QuestionActionState;
	formAction: (formData: FormData) => void;
	pending: boolean;
	questionId?: string;
};

function QuestionFields({state, formAction, pending, questionId}: QuestionFieldsProps) {
	const [values, setValues] = useState(state.values);
	
	function changeValue(field: keyof QuestionActionState['values'], value: string) {
		setValues((current) => ({...current, [field]: value}));
	}
	
	return (
		<form action={formAction} className="space-y-6">
			{questionId ? <input type="hidden" name="id" value={questionId}/> : null}
			{state.errors.form ? <InlineAlert>{state.errors.form}</InlineAlert> : null}
			<div className="space-y-2">
				<label htmlFor="subject" className="block text-sm font-semibold">Subject</label>
				<select id="subject" name="subject" autoComplete="off" required value={values.subject}
				        aria-invalid={Boolean(state.errors.subject)}
				        aria-describedby={state.errors.subject ? 'subject-error' : undefined}
				        onChange={(event) => changeValue('subject', event.target.value)}
				        className="min-h-12 w-full rounded-sm border border-rule bg-ink px-4 py-3 text-base text-bone outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember">
					<option value="">Choose a subject</option>
					{QUESTION_SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
				</select>
				{state.errors.subject ? <p id="subject-error" role="alert" className="text-sm text-rose">{state.errors.subject}</p> : null}
			</div>
			<div className="space-y-2">
				<label htmlFor="difficulty" className="block text-sm font-semibold">Difficulty</label>
				<select id="difficulty" name="difficulty" autoComplete="off" required value={values.difficulty}
				        aria-invalid={Boolean(state.errors.difficulty)}
				        aria-describedby={state.errors.difficulty ? 'difficulty-error' : undefined}
				        onChange={(event) => changeValue('difficulty', event.target.value)}
				        className="min-h-12 w-full rounded-sm border border-rule bg-ink px-4 py-3 text-base text-bone outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember">
					<option value="">Choose a difficulty</option>
					{QUESTION_DIFFICULTIES.map((difficulty) => <option key={difficulty}
					                                                   value={difficulty}>{difficulty}</option>)}
				</select>
				{state.errors.difficulty ? <p id="difficulty-error" role="alert" className="text-sm text-rose">{state.errors.difficulty}</p> : null}
			</div>
			<div className="space-y-2">
				<label htmlFor="text" className="block text-sm font-semibold">Question</label>
				<textarea id="text" name="text" autoComplete="off" required maxLength={200} value={values.text}
				          aria-invalid={Boolean(state.errors.text)}
				          aria-describedby={state.errors.text ? 'text-error' : undefined}
				          onChange={(event) => changeValue('text', event.target.value)}
				          className="min-h-32 w-full rounded-sm border border-rule bg-ink px-4 py-3 text-base text-bone outline-none focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember"/>
				{state.errors.text ? <p id="text-error" role="alert" className="text-sm text-rose">{state.errors.text}</p> : null}
			</div>
			<fieldset className="space-y-4 border-t border-rule pt-5">
				<legend className="font-display text-lg font-semibold">Options and correct answer</legend>
				<p className="text-sm text-bone-muted">Mark one option as correct. Enter four answer options.</p>
				{[0, 1, 2, 3].map((index) => {
					const field = `option${index}` as 'option0' | 'option1' | 'option2' | 'option3';
					return (
						<div key={field}
						     className="grid min-w-0 gap-3 rounded-sm border border-rule bg-ink p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
							<div className="min-w-0">
								<Field
									id={`option-${index}`}
									name={field}
									autoComplete="off"
									required
									maxLength={80}
									value={values[field]}
									onChange={(event) => changeValue(field, event.target.value)}
									label={`Option ${index + 1} text`}
									error={index === 0 ? state.errors.options : undefined}
								/>
							</div>
							<label htmlFor={`correct-${index}`}
							       className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-rule px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-ember">
								<input id={`correct-${index}`} name="correctIndex" type="radio" value={index} required
								       aria-describedby={state.errors.correctIndex ? 'correct-index-error' : undefined}
								       checked={values.correctIndex === String(index)}
								       onChange={(event) => changeValue('correctIndex', event.target.value)}
								       className="size-5 accent-ember"/>
								<span>Correct answer</span>
							</label>
						</div>
					);
				})}
				{state.errors.correctIndex ? <p id="correct-index-error" role="alert" className="text-sm text-rose">{state.errors.correctIndex}</p> : null}
			</fieldset>
			<Button type="submit" disabled={pending} size="large">
				{pending ? 'Saving…' : questionId ? 'Save question' : 'Create question'}
			</Button>
		</form>
	);
}
