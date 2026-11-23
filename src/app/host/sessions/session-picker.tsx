'use client';

import { useActionState, useState } from 'react';
import { QUESTION_SUBJECTS } from '../../../lib/questions/validate';
import { createSessionAction, type CreateSessionActionState } from './actions';

export type SessionPickerQuestion = {
  id: string;
  subject: string;
  difficulty: string;
  text: string;
};

const initialActionState: CreateSessionActionState = { error: null };

export function SessionPicker({ questions }: { questions: SessionPickerQuestion[] }) {
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
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="questionIds" value={lineup.map((question) => question.id).join(',')} />

      <section aria-labelledby="question-search-heading" className="space-y-4 rounded border p-4">
        <h2 id="question-search-heading" className="text-lg font-semibold">Choose questions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="question-subject" className="block font-medium">Filter by subject</label>
            <select id="question-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 w-full rounded border p-2">
              <option value="all">All subjects</option>
              {QUESTION_SUBJECTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="question-search" className="block font-medium">Search question text</label>
            <input id="question-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </div>
        </div>

        <ul aria-label="Available questions" className="max-h-96 space-y-2 overflow-y-auto">
          {visibleQuestions.map((question) => {
            const alreadySelected = selectedIds.has(question.id);
            return (
              <li key={question.id} className="flex items-start justify-between gap-4 rounded border p-3">
                <div>
                  <p className="text-sm capitalize text-gray-600">{question.subject} · {question.difficulty}</p>
                  <p>{question.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addQuestion(question)}
                  disabled={alreadySelected || lineup.length >= 15}
                  aria-label={`Add question: ${question.text}`}
                  className="shrink-0 rounded border px-3 py-1 disabled:opacity-50"
                >
                  {alreadySelected ? 'Added' : 'Add'}
                </button>
              </li>
            );
          })}
          {visibleQuestions.length === 0 ? <li className="p-3 text-gray-600">No questions match these filters.</li> : null}
        </ul>
      </section>

      <section aria-labelledby="lineup-heading" className="space-y-4 rounded border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="lineup-heading" className="text-lg font-semibold">Session lineup</h2>
          <p aria-live="polite">{lineup.length} / 15 selected</p>
        </div>
        <ol className="space-y-2">
          {lineup.map((question, index) => (
            <li key={question.id} className="flex flex-wrap items-center gap-2 rounded border p-3">
              <span className="w-8 font-semibold">{index + 1}.</span>
              <span className="min-w-0 flex-1">{question.text}</span>
              <button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label={`Move question ${index + 1} up`} className="rounded border px-2 py-1 disabled:opacity-50">Move up</button>
              <button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === lineup.length - 1} aria-label={`Move question ${index + 1} down`} className="rounded border px-2 py-1 disabled:opacity-50">Move down</button>
              <button type="button" onClick={() => removeQuestion(question.id)} aria-label={`Remove question ${index + 1}`} className="rounded border px-2 py-1">Remove</button>
            </li>
          ))}
        </ol>
        {lineup.length === 0 ? <p className="text-gray-600">Add questions to set their order.</p> : null}
      </section>

      {actionState.error ? <p role="alert" className="text-red-700">{actionState.error}</p> : null}
      <button type="submit" disabled={lineup.length !== 15 || pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Creating session…' : 'Create session'}
      </button>
    </form>
  );
}
