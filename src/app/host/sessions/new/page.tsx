import { requireHost } from '../../../../lib/auth/require-host';
import { createClient } from '../../../../lib/supabase/server';
import { SessionPicker, type SessionPickerQuestion } from '../session-picker';

export default async function NewSessionPage() {
  const hostId = await requireHost();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('questions')
    .select('id, subject, difficulty, text')
    .eq('created_by', hostId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  const questions = error ? [] : (data ?? []) as SessionPickerQuestion[];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Create a session</h1>
        <p>Choose 15 questions and arrange them in the order they will appear.</p>
      </header>
      {error ? <p role="alert" className="text-red-700">Questions could not be loaded. Try again.</p> : null}
      <SessionPicker questions={questions} />
    </main>
  );
}
