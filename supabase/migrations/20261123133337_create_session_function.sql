create function public.create_session(
  p_host_id uuid,
  p_code text,
  p_public_state jsonb,
  p_engine_state jsonb,
  p_question_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_session_id uuid;
  matching_question_count bigint;
begin
  if p_question_ids is null then
    raise exception 'question ids are required';
  end if;

  if pg_catalog.cardinality(p_question_ids) <> 15 then
    raise exception 'exactly 15 question ids are required';
  end if;

  if exists (
    select requested.question_id
    from pg_catalog.unnest(p_question_ids) as requested(question_id)
    group by requested.question_id
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'question ids must be distinct';
  end if;

  select pg_catalog.count(*)
  into matching_question_count
  from pg_catalog.unnest(p_question_ids) as requested(question_id)
  join public.questions as q
    on q.id = requested.question_id
   and q.created_by = p_host_id
  join public.question_answers as qa
    on qa.question_id = q.id;

  if matching_question_count <> 15 then
    raise exception 'all questions must belong to the host and have answers';
  end if;

  insert into public.sessions (code, host_id, public_state, current_question)
  values (p_code, p_host_id, p_public_state, null)
  returning id into new_session_id;

  insert into public.session_private (session_id, engine_state)
  values (new_session_id, p_engine_state);

  insert into public.session_questions (session_id, position, question_id)
  select new_session_id, requested.ordinality::integer, requested.question_id
  from pg_catalog.unnest(p_question_ids) with ordinality as requested(question_id, ordinality);

  return new_session_id;
end;
$$;

comment on function public.create_session(uuid, text, jsonb, jsonb, uuid[])
is 'Only server code, which has already verified the caller is a host, may call this function.';

revoke execute on function public.create_session(uuid, text, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.create_session(uuid, text, jsonb, jsonb, uuid[]) to service_role;
