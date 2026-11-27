import {notFound} from 'next/navigation';
import {requireHost} from '../../../../../lib/auth/require-host';
import type {QuestionActionState} from '../../actions';
import {Card} from '../../../../../components/stage/card';
import {PageHeader} from '../../../../../components/stage/page-header';
import {QuestionForm} from '../../question-form';
import {createClient} from '../../../../../lib/supabase/server';

type EditQuestionRow = {
	subject: string;
	difficulty: string;
	text: string;
	options: string[];
	question_answers: { correct_index: number } | { correct_index: number }[] | null;
};

export default async function EditQuestionPage({params}: { params: Promise<{ id: string }> }) {
	const hostId = await requireHost();
	const {id} = await params;
	const supabase = await createClient();
	const {data, error} = await supabase
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
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6 sm:py-12">
			<PageHeader title="Edit question"/>
			<p className="max-w-prose text-bone-muted">Update the question, its options, or the correct answer.</p>
			<Card className="mx-auto w-full max-w-3xl">
				<QuestionForm questionId={id} initialValues={values}/>
			</Card>
		</main>
	);
}
