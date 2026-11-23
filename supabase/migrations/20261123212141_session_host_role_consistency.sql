create or replace function private.is_session_host(p_session_id uuid)
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
      and (select private.is_host()) is true
  );
$$;

drop policy "members and hosts read participants" on public.participants;
create policy "members and hosts read participants" on public.participants
for select to authenticated
using (
  private.is_session_member(session_id)
  or (select private.is_session_host(session_id))
);

drop policy "hosts read session questions" on public.session_questions;
create policy "hosts read session questions" on public.session_questions
for select to authenticated
using (
  (select private.is_session_host(session_id))
);

do $$
declare
  offending_policies text;
begin
  select string_agg(policyname, ', ' order by policyname)
  into offending_policies
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and (qual ilike '%is_anonymous%' or with_check ilike '%is_anonymous%');

  if offending_policies is not null then
    raise exception 'Policies still mention is_anonymous: %', offending_policies;
  end if;
end;
$$;