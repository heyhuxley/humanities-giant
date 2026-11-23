import { notFound } from 'next/navigation';
import { requireHost } from '../../../../../lib/auth/require-host';
import type { QuestionActionState } from '../../actions';
import { QuestionForm } from '../../question-form';
import { createClient } from '../../../../../lib/supabase/server';

type EditQuestionRow = {
  subject: string;
  difficulty: string;
  text: string;
  options: string[];
  question_answers: { correct_index: number } | { correct_index: number }[] | null;
};

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const hostId = await requireHost();
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('questions')
    .select('subject, difficulty, text, options, question_answers(correct_index)')
    .eq('id', id)
    .eq('created_by', hostId)
    .maybeSingle();
  if (error || !data) notFound();
  const question = data as unknown as EditQuestionRow;
  const relation = Array.isArray(question.question_answers) ? question.question_answers[0] : question.question_answers;
  if (!relation || question.options.length !== 4) notFound();
  const values: QuestionActionState['values'] = {
    subject: question.subject,
    difficulty: question.difficulty,
    text: question.text,
    option0: question.options[0],
    option1: question.options[1],
    option2: question.options[2],
    option3: question.options[3],
    correctIndex: String(relation.correct_index),
  };
  return <main className="mx-auto max-w-3xl space-y-5 p-6"><h1 className="text-2xl font-bold">Edit question</h1><QuestionForm questionId={id} initialValues={values} /></main>;
}
