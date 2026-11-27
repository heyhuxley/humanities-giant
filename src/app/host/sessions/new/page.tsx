import {requireHost} from '../../../../lib/auth/require-host';
import {createClient} from '../../../../lib/supabase/server';
import {InlineAlert} from '../../../../components/stage/inline-alert';
import {PageHeader} from '../../../../components/stage/page-header';
import {SessionPicker, type SessionPickerQuestion} from '../session-picker';

export default async function NewSessionPage() {
	const hostId = await requireHost();
	const supabase = await createClient();
	const {data, error} = await supabase
		.from('questions')
		.select('id, subject, difficulty, text')
		.eq('created_by', hostId)
		.order('created_at', {ascending: false})
		.order('id', {ascending: false});
	const questions = error ? [] : (data ?? []) as SessionPickerQuestion[];
	
	return (
		<main id="main" tabIndex={-1}
		      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-6 sm:py-12">
			<PageHeader title="Create a session"/>
			<p className="max-w-prose text-bone-muted">Choose 15 questions and arrange them in the order they will
				appear.</p>
			{error ? <InlineAlert>Questions could not be loaded. Try again.</InlineAlert> : null}
			<SessionPicker questions={questions}/>
		</main>
	);
}
