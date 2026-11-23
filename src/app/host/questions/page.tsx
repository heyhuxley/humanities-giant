import Link from 'next/link';
import { requireHost } from '../../../lib/auth/require-host';
import { QUESTION_DIFFICULTIES, QUESTION_SUBJECTS } from '../../../lib/questions/validate';
import { createClient } from '../../../lib/supabase/server';
import { DeleteQuestionForm } from './delete-question-form';

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

export default async function QuestionsPage({ searchParams }: { searchParams: SearchParams }) {
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
    .select('id, subject, difficulty, text, options, created_at, question_answers(correct_index)', { count: 'exact' })
    .eq('created_by', hostId);
  if (subject) query = query.eq('subject', subject);
  if (difficulty) query = query.eq('difficulty', difficulty);
  const start = (page - 1) * 20;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + 19);
  const rows = error ? [] : (data ?? []) as unknown as QuestionRow[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / 20));
  const notice = oneString(params.notice);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Question bank</h1><p>Manage your questions and answers.</p></div>
        <Link className="rounded bg-gray-900 px-4 py-2 text-white" href="/host/questions/new">Create question</Link>
      </header>
      {notice === 'used' ? <p role="alert" className="text-red-700">This question is used in a session and can&apos;t be deleted.</p> : null}
      {notice === 'failed' ? <p role="alert" className="text-red-700">Something went wrong. Try again.</p> : null}
      {notice === 'deleted' ? <p role="status" className="text-green-800">Question deleted.</p> : null}
      {error ? <p role="alert" className="text-red-700">Questions could not be loaded. Try again.</p> : null}

      <form method="get" className="flex flex-wrap items-end gap-4 rounded border p-4">
        <div>
          <label htmlFor="subject-filter" className="block font-medium">Subject</label>
          <select id="subject-filter" name="subject" defaultValue={subject ?? ''} className="rounded border p-2">
            <option value="">All subjects</option>
            {QUESTION_SUBJECTS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="difficulty-filter" className="block font-medium">Difficulty</label>
          <select id="difficulty-filter" name="difficulty" defaultValue={difficulty ?? ''} className="rounded border p-2">
            <option value="">All difficulties</option>
            {QUESTION_DIFFICULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded border px-4 py-2">Filter</button>
      </form>

      {rows.length === 0 ? (
        <section className="rounded border p-6">
          <p>No questions found.</p>
          <Link className="mt-2 inline-block underline" href="/host/questions/new">Create your first question</Link>
        </section>
      ) : (
        <div className="space-y-4">
          {rows.map((question) => {
            const answerRelation = Array.isArray(question.question_answers) ? question.question_answers[0] : question.question_answers;
            return (
              <article key={question.id} className="space-y-3 rounded border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm capitalize text-gray-600">{question.subject} · {question.difficulty}</p><h2 className="font-semibold">{question.text}</h2></div>
                  <div className="flex items-center gap-4">
                    <Link className="underline" href={`/host/questions/${question.id}/edit`}>Edit</Link>
                    <DeleteQuestionForm questionId={question.id} />
                  </div>
                </div>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, index) => (
                    <li key={`${question.id}-${index}`} className={answerRelation?.correct_index === index ? 'rounded border border-green-700 bg-green-50 p-2 font-semibold' : 'rounded border p-2'}>
                      {String.fromCharCode(65 + index)}. {option}{answerRelation?.correct_index === index ? ' — Correct answer' : ''}
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Question pages" className="flex items-center gap-4">
          {page > 1 ? <Link href={pageHref(page - 1, subject, difficulty)} className="underline">Previous</Link> : null}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={pageHref(page + 1, subject, difficulty)} className="underline">Next</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}

function pageHref(page: number, subject?: string, difficulty?: string): string {
  const params = new URLSearchParams({ page: String(page) });
  if (subject) params.set('subject', subject);
  if (difficulty) params.set('difficulty', difficulty);
  return `/host/questions?${params.toString()}`;
}
