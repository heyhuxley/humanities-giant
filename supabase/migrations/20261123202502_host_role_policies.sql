create function private.is_host()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'host'
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false;
$$;

revoke all on function private.is_host() from public, anon;
grant execute on function private.is_host() to authenticated;

drop policy "hosts select own questions" on public.questions;
create policy "hosts select own questions" on public.questions
for select to authenticated
using (
  created_by = (select auth.uid())
  and (select private.is_host())
);

drop policy "hosts insert own questions" on public.questions;
create policy "hosts insert own questions" on public.questions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_host())
);

drop policy "hosts update own questions" on public.questions;
create policy "hosts update own questions" on public.questions
for update to authenticated
using (
  created_by = (select auth.uid())
  and (select private.is_host())
)
with check (
  created_by = (select auth.uid())
  and (select private.is_host())
);

drop policy "hosts delete own questions" on public.questions;
create policy "hosts delete own questions" on public.questions
for delete to authenticated
using (
  created_by = (select auth.uid())
  and (select private.is_host())
);

drop policy "hosts select answers for own questions" on public.question_answers;
create policy "hosts select answers for own questions" on public.question_answers
for select to authenticated
using (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and (select private.is_host())
);

drop policy "hosts insert answers for own questions" on public.question_answers;
create policy "hosts insert answers for own questions" on public.question_answers
for insert to authenticated
with check (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and (select private.is_host())
);

drop policy "hosts update answers for own questions" on public.question_answers;
create policy "hosts update answers for own questions" on public.question_answers
for update to authenticated
using (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and (select private.is_host())
)
with check (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and (select private.is_host())
);

drop policy "hosts delete answers for own questions" on public.question_answers;
create policy "hosts delete answers for own questions" on public.question_answers
for delete to authenticated
using (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and (select private.is_host())
);

drop policy "hosts and members read sessions" on public.sessions;
create policy "hosts and members read sessions" on public.sessions
for select to authenticated
using (
  (
    host_id = (select auth.uid())
    and (select private.is_host())
  )
  or private.is_session_member(id)
);