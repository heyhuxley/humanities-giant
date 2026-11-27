'use client';

import {Button} from '../../../components/stage/button';
import {deleteQuestionAction} from './actions';

export function DeleteQuestionForm({questionId}: { questionId: string }) {
	return (
		<form action={deleteQuestionAction} onSubmit={(event) => {
			if (!window.confirm('Delete this question?')) event.preventDefault();
		}}>
			<input type="hidden" name="id" value={questionId}/>
			<Button type="submit" variant="danger">Delete</Button>
		</form>
	);
}
