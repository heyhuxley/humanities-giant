create function public.create_question(
  p_subject text,
  p_difficulty text,
  p_text text,
  p_options jsonb,
  p_correct_index integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_question_id uuid;
begin
  insert into public.questions (subject, difficulty, text, options, created_by)
  values (p_subject, p_difficulty, p_text, p_options, (select auth.uid()))
  returning id into new_question_id;

  insert into public.question_answers (question_id, correct_index)
  values (new_question_id, p_correct_index);

  return new_question_id;
end;
$$;

comment on function public.create_question(text, text, text, jsonb, integer)
is 'Security invoker on purpose so row level security still applies.';

create function public.update_question(
  p_id uuid,
  p_subject text,
  p_difficulty text,
  p_text text,
  p_options jsonb,
  p_correct_index integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_rows integer;
begin
  update public.questions
  set subject = p_subject,
      difficulty = p_difficulty,
      text = p_text,
      options = p_options
  where id = p_id;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'question not found';
  end if;

  update public.question_answers
  set correct_index = p_correct_index
  where question_id = p_id;
end;
$$;

comment on function public.update_question(uuid, text, text, text, jsonb, integer)
is 'Security invoker on purpose so row level security still applies.';

revoke all on function public.create_question(text, text, text, jsonb, integer) from public, anon;
revoke all on function public.update_question(uuid, text, text, text, jsonb, integer) from public, anon;
grant execute on function public.create_question(text, text, text, jsonb, integer) to authenticated;
grant execute on function public.update_question(uuid, text, text, text, jsonb, integer) to authenticated;
