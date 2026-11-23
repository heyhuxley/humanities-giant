'use client';

import { deleteQuestionAction } from './actions';

export function DeleteQuestionForm({ questionId }: { questionId: string }) {
  return (
    <form action={deleteQuestionAction} onSubmit={(event) => {
      if (!window.confirm('Delete this question?')) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={questionId} />
      <button type="submit" className="text-red-700 underline">Delete</button>
    </form>
  );
}
