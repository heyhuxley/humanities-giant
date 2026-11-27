'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireHost } from '../../../lib/auth/require-host';
import { createClient } from '../../../lib/supabase/server';
import { mapQuestionDbError } from '../../../lib/questions/db-errors';
import { formDataToQuestionInput } from '../../../lib/questions/form-data';
import { validateQuestionInput } from '../../../lib/questions/validate';

export type QuestionFormValues = {
  subject: string;
  difficulty: string;
  text: string;
  option0: string;
  option1: string;
  option2: string;
  option3: string;
  correctIndex: string;
};
export type QuestionActionState = { errors: Record<string, string>; values: QuestionFormValues };

function submittedValues(formData: FormData): QuestionFormValues {
  return {
    subject: String(formData.get('subject') ?? ''),
    difficulty: String(formData.get('difficulty') ?? ''),
    text: String(formData.get('text') ?? ''),
    option0: String(formData.get('option0') ?? ''),
    option1: String(formData.get('option1') ?? ''),
    option2: String(formData.get('option2') ?? ''),
    option3: String(formData.get('option3') ?? ''),
    correctIndex: String(formData.get('correctIndex') ?? ''),
  };
}

export async function createQuestionAction(_previous: QuestionActionState, formData: FormData): Promise<QuestionActionState> {
  await requireHost();
  const values = submittedValues(formData);
  const validation = validateQuestionInput(formDataToQuestionInput(formData));
  if (!validation.ok) return { errors: validation.errors, values };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_question', {
    p_subject: validation.value.subject,
    p_difficulty: validation.value.difficulty,
    p_text: validation.value.text,
    p_options: validation.value.options,
    p_correct_index: validation.value.correctIndex,
  });
  if (error) return { errors: { form: mapQuestionDbError(error) }, values };
  revalidatePath('/host/questions');
  redirect('/host/questions');
}

export async function updateQuestionAction(_previous: QuestionActionState, formData: FormData): Promise<QuestionActionState> {
  await requireHost();
  const values = submittedValues(formData);
  const questionId = formData.get('id');
  const validation = validateQuestionInput(formDataToQuestionInput(formData));
  if (!validation.ok) return { errors: validation.errors, values };
  if (typeof questionId !== 'string' || questionId.length === 0) return { errors: { form: 'Something went wrong. Try again.' }, values };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_question', {
    p_id: questionId,
    p_subject: validation.value.subject,
    p_difficulty: validation.value.difficulty,
    p_text: validation.value.text,
    p_options: validation.value.options,
    p_correct_index: validation.value.correctIndex,
  });
  if (error) return { errors: { form: mapQuestionDbError(error) }, values };
  revalidatePath('/host/questions');
  redirect('/host/questions');
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  await requireHost();
  const questionId = formData.get('id');
  if (typeof questionId !== 'string' || questionId.length === 0) redirect('/host/questions?notice=failed');
  const supabase = await createClient();
  const { data, error } = await supabase.from('questions').delete().eq('id', questionId).select('id');
  if (error) {
    const message = mapQuestionDbError(error);
    redirect(`/host/questions?notice=${message.includes("used in a session") ? 'used' : 'failed'}`);
  }
  if (!data || data.length === 0) redirect('/host/questions?notice=failed');
  revalidatePath('/host/questions');
  redirect('/host/questions?notice=deleted');
}

