import {requireHost} from '../../../../lib/auth/require-host';
import {Card} from '../../../../components/stage/card';
import {PageHeader} from '../../../../components/stage/page-header';
import {QuestionForm} from '../question-form';

export default async function NewQuestionPage() {
	await requireHost();
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6 sm:py-12">
			<PageHeader title="Create question"/>
			<p className="max-w-prose text-bone-muted">Write a question, add four options, and choose the correct
				answer.</p>
			<Card className="mx-auto w-full max-w-3xl">
				<QuestionForm/>
			</Card>
		</main>
	);
}
