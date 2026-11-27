alter table public.session_private
add column version integer not null default 0;

create function public.commit_transition(
  p_session_id uuid,
  p_expected_version integer,
  p_engine_state jsonb,
  p_public_state jsonb,
  p_current_question jsonb,
  p_set_contestant_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_version integer;
begin
  if
    p_public_state #> '{lifelines,phone,hintIsCorrect}' is not null
    and (p_public_state #> '{lifelines,phone,hintIsCorrect}') is distinct from 'null'::jsonb
  then
    raise exception using errcode = 'PJ005', message = 'unsafe public data';
  end if;

  if
    p_public_state ->> 'status' in ('question_active', 'locked')
    and p_public_state -> 'correctIndex' is not null
    and (p_public_state -> 'correctIndex') is distinct from 'null'::jsonb
  then
    raise exception using errcode = 'PJ005', message = 'unsafe public data';
  end if;

  if p_current_question is not null and p_current_question is distinct from 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_current_question) <> 'object' then
      raise exception using errcode = 'PJ005', message = 'unsafe public data';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_current_question) as question_key(key)
      where question_key.key not in ('id', 'text', 'options')
    ) then
      raise exception using errcode = 'PJ005', message = 'unsafe public data';
    end if;
  end if;

  update public.session_private as session_private
  set engine_state = p_engine_state,
      version = session_private.version + 1
  where session_private.session_id = p_session_id
    and session_private.version = p_expected_version
  returning session_private.version into new_version;

  if not found then
    raise exception using errcode = 'PJ003', message = 'version conflict';
  end if;

  update public.sessions as session
  set public_state = p_public_state,
      current_question = case
        when p_current_question = 'null'::jsonb then null
        else p_current_question
      end
  where session.id = p_session_id;

  if p_set_contestant_id is not null then
    update public.participants as participant
    set role = 'audience'
    where participant.session_id = p_session_id
      and participant.role = 'contestant';

    update public.participants as participant
    set role = 'contestant'
    where participant.id = p_set_contestant_id
      and participant.session_id = p_session_id;

    if not found then
      raise exception using errcode = 'PJ004', message = 'participant not found';
    end if;
  end if;

  return new_version;
end;
$$;

comment on function public.commit_transition(uuid, integer, jsonb, jsonb, jsonb, uuid)
is 'Callable only by server code with the service role so callers cannot bypass transition validation. Uses the expected session version as a compare-and-swap guard so concurrent transitions cannot overwrite each other.';

revoke execute on function public.commit_transition(uuid, integer, jsonb, jsonb, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.commit_transition(uuid, integer, jsonb, jsonb, jsonb, uuid)
to service_role;