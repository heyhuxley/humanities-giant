import { requireHost } from '../../../../lib/auth/require-host';
import { QuestionForm } from '../question-form';

export default async function NewQuestionPage() {
  await requireHost();
  return <main className="mx-auto max-w-3xl space-y-5 p-6"><h1 className="text-2xl font-bold">Create question</h1><QuestionForm /></main>;
}
