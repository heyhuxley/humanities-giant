create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants as participant
    where participant.session_id = p_session_id
      and participant.user_id = (select auth.uid())
  );
$$;

create function private.is_session_host(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions as session
    where session.id = p_session_id
      and session.host_id = (select auth.uid())
  );
$$;

revoke all on function private.is_session_member(uuid) from public, anon;
revoke all on function private.is_session_host(uuid) from public, anon;
grant execute on function private.is_session_member(uuid) to authenticated;
grant execute on function private.is_session_host(uuid) to authenticated;

revoke all privileges on table
  public.questions,
  public.question_answers,
  public.sessions,
  public.session_private,
  public.session_questions,
  public.participants,
  public.votes
from anon;

revoke all privileges on table
  public.questions,
  public.question_answers,
  public.sessions,
  public.session_private,
  public.session_questions,
  public.participants,
  public.votes
from authenticated;

grant select, insert, update, delete on table public.questions to authenticated;
grant select, insert, update, delete on table public.question_answers to authenticated;
grant select on table public.sessions to authenticated;
grant select on table public.participants to authenticated;
grant select on table public.session_questions to authenticated;

-- Non anonymous hosts can read only questions they own.
create policy "hosts select own questions" on public.questions
for select to authenticated
using (
  created_by = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can add questions owned by their own user id.
create policy "hosts insert own questions" on public.questions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can update only questions they own and keep ownership.
create policy "hosts update own questions" on public.questions
for update to authenticated
using (
  created_by = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
)
with check (
  created_by = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can delete only questions they own.
create policy "hosts delete own questions" on public.questions
for delete to authenticated
using (
  created_by = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can read answers for questions they own.
create policy "hosts select answers for own questions" on public.question_answers
for select to authenticated
using (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can add answers only for questions they own.
create policy "hosts insert answers for own questions" on public.question_answers
for insert to authenticated
with check (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can update answers only for questions they own.
create policy "hosts update answers for own questions" on public.question_answers
for update to authenticated
using (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
)
with check (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Non anonymous hosts can delete answers only for questions they own.
create policy "hosts delete answers for own questions" on public.question_answers
for delete to authenticated
using (
  exists (
    select 1 from public.questions as question
    where question.id = question_id and question.created_by = (select auth.uid())
  )
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

-- Hosts and session members can read session public state.
create policy "hosts and members read sessions" on public.sessions
for select to authenticated
using (
  (
    host_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  )
  or private.is_session_member(id)
);

-- Session members and non anonymous hosts can read participant lists.
create policy "members and hosts read participants" on public.participants
for select to authenticated
using (
  private.is_session_member(session_id)
  or (
    private.is_session_host(session_id)
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  )
);

-- Non anonymous session hosts can read the selected question order.
create policy "hosts read session questions" on public.session_questions
for select to authenticated
using (
  private.is_session_host(session_id)
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
);

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.participants;
