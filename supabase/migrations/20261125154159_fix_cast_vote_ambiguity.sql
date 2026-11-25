create or replace function public.cast_vote(
  p_session_id uuid,
  p_user_id uuid,
  p_option integer,
  p_now_ms bigint
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_engine_state jsonb;
  v_participant_id uuid;
  v_role text;
  v_status text;
  v_position_text text;
  v_ends_at_text text;
  v_position integer;
  v_ends_at_ms bigint;
begin
  if p_option is null or p_option not between 0 and 3 then
    raise exception using errcode = 'PJ008', message = 'invalid option';
  end if;

  -- This row lock serializes votes against transitions; commit_transition takes the same lock first, so they cannot deadlock.
  select session_private.engine_state
  into v_engine_state
  from public.session_private as session_private
  where session_private.session_id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'PJ001', message = 'session unavailable';
  end if;

  select participant.id, participant.role
  into v_participant_id, v_role
  from public.participants as participant
  where participant.session_id = p_session_id
    and participant.user_id = p_user_id;

  if not found then
    raise exception using errcode = 'PJ004', message = 'participant not found';
  end if;

  if v_role <> 'audience' then
    raise exception using errcode = 'PJ009', message = 'not an audience member';
  end if;

  v_status := v_engine_state ->> 'status';
  v_position_text := v_engine_state ->> 'position';
  v_ends_at_text := v_engine_state ->> 'questionEndsAt';

  if v_status is distinct from 'question_active'
    or pg_catalog.jsonb_typeof(v_engine_state -> 'position') is distinct from 'number'
    or pg_catalog.jsonb_typeof(v_engine_state -> 'questionEndsAt') is distinct from 'number'
    or v_position_text !~ '^[0-9]+$'
    or v_ends_at_text !~ '^-?[0-9]+$'
    or p_now_ms is null
  then
    raise exception using errcode = 'PJ007', message = 'voting closed';
  end if;

  begin
    v_position := v_position_text::integer;
    v_ends_at_ms := v_ends_at_text::bigint;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'PJ007', message = 'voting closed';
  end;

  if v_position < 1
    or v_position > 15
    or p_now_ms >= v_ends_at_ms
  then
    raise exception using errcode = 'PJ007', message = 'voting closed';
  end if;

  insert into public.votes (session_id, position, participant_id, option_index)
  values (p_session_id, v_position, v_participant_id, p_option)
  on conflict (session_id, position, participant_id)
  do update set option_index = excluded.option_index;

  return v_position;
end;
$$;

comment on function public.cast_vote(uuid, uuid, integer, bigint)
is 'Only server code may call this function so caller identity and voting rules stay on the server.';

revoke execute on function public.cast_vote(uuid, uuid, integer, bigint)
from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid, integer, bigint)
to service_role;

do $$
begin
  if pg_catalog.to_regprocedure('public.cast_vote(uuid,uuid,integer,bigint)') is null
    or exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = pg_catalog.to_regprocedure('public.cast_vote(uuid,uuid,integer,bigint)')
        and procedure.prosecdef
    )
  then
    raise exception 'public.cast_vote(uuid, uuid, integer, bigint) is missing or security definer';
  end if;
end;
$$;
