'use client';

import { useActionState, useState } from 'react';
import type { QuestionActionState } from './actions';
import { createQuestionAction, updateQuestionAction } from './actions';
import { QUESTION_DIFFICULTIES, QUESTION_SUBJECTS } from '../../../lib/questions/validate';

type QuestionFormProps = { initialValues?: QuestionActionState['values']; questionId?: string };
const initialState: QuestionActionState = {
  errors: {},
  values: { subject: '', difficulty: '', text: '', option0: '', option1: '', option2: '', option3: '', correctIndex: '' },
};

export function QuestionForm({ initialValues, questionId }: QuestionFormProps) {
  const action = questionId ? updateQuestionAction : createQuestionAction;
  const [state, formAction, pending] = useActionState(action, { ...initialState, values: initialValues ?? initialState.values });
  return <QuestionFields key={JSON.stringify(state.values)} state={state} formAction={formAction} pending={pending} questionId={questionId} />;
}

type QuestionFieldsProps = {
  state: QuestionActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  questionId?: string;
};

function QuestionFields({ state, formAction, pending, questionId }: QuestionFieldsProps) {
  const [values, setValues] = useState(state.values);
  function changeValue(field: keyof QuestionActionState['values'], value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {questionId ? <input type="hidden" name="id" value={questionId} /> : null}
      {state.errors.form ? <p role="alert" className="text-red-700">{state.errors.form}</p> : null}
      <div>
        <label htmlFor="subject" className="block font-medium">Subject</label>
        <select id="subject" name="subject" required value={values.subject} onChange={(event) => changeValue('subject', event.target.value)} className="mt-1 w-full rounded border p-2">
          <option value="">Choose a subject</option>
          {QUESTION_SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
        </select>
        {state.errors.subject ? <p className="text-red-700">{state.errors.subject}</p> : null}
      </div>
      <div>
        <label htmlFor="difficulty" className="block font-medium">Difficulty</label>
        <select id="difficulty" name="difficulty" required value={values.difficulty} onChange={(event) => changeValue('difficulty', event.target.value)} className="mt-1 w-full rounded border p-2">
          <option value="">Choose a difficulty</option>
          {QUESTION_DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
        </select>
        {state.errors.difficulty ? <p className="text-red-700">{state.errors.difficulty}</p> : null}
      </div>
      <div>
        <label htmlFor="text" className="block font-medium">Question</label>
        <textarea id="text" name="text" required maxLength={200} value={values.text} onChange={(event) => changeValue('text', event.target.value)} className="mt-1 w-full rounded border p-2" />
        {state.errors.text ? <p className="text-red-700">{state.errors.text}</p> : null}
      </div>
      <fieldset className="space-y-3">
        <legend className="font-medium">Options and correct answer</legend>
        {[0, 1, 2, 3].map((index) => {
          const field = `option${index}` as 'option0' | 'option1' | 'option2' | 'option3';
          return (
            <div key={field} className="flex items-center gap-3">
              <label htmlFor={`correct-${index}`} className="sr-only">Mark option {index + 1} as correct</label>
              <input id={`correct-${index}`} name="correctIndex" type="radio" value={index} required checked={values.correctIndex === String(index)} onChange={(event) => changeValue('correctIndex', event.target.value)} />
              <label htmlFor={`option-${index}`} className="sr-only">Option {index + 1} text</label>
              <input id={`option-${index}`} name={field} required maxLength={80} value={values[field]} onChange={(event) => changeValue(field, event.target.value)} className="w-full rounded border p-2" />
            </div>
          );
        })}
        {state.errors.options ? <p className="text-red-700">{state.errors.options}</p> : null}
        {state.errors.correctIndex ? <p className="text-red-700">{state.errors.correctIndex}</p> : null}
        <p className="text-sm text-gray-600">Choose the radio button beside the correct option.</p>
      </fieldset>
      <button type="submit" disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Saving…' : questionId ? 'Save question' : 'Create question'}
      </button>
    </form>
  );
}
