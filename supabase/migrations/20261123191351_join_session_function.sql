create function public.join_session(
  p_user_id uuid,
  p_code text,
  p_display_name text,
  p_max_audience integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_session_id uuid;
  target_status text;
  target_participant_id uuid;
  audience_count bigint;
begin
  -- Locking the session row serializes joins to the same session before checking capacity.
  select session.id, session.public_state ->> 'status'
  into target_session_id, target_status
  from public.sessions as session
  where session.code = p_code
  for update;

  if not found or target_status = 'finished' then
    raise exception using errcode = 'PJ001', message = 'session unavailable';
  end if;

  select participant.id
  into target_participant_id
  from public.participants as participant
  where participant.session_id = target_session_id
    and participant.user_id = p_user_id;

  if found then
    update public.participants as participant
    set display_name = p_display_name
    where participant.id = target_participant_id;
  else
    select pg_catalog.count(*)
    into audience_count
    from public.participants as participant
    where participant.session_id = target_session_id
      and participant.role = 'audience';

    if audience_count >= p_max_audience then
      raise exception using errcode = 'PJ002', message = 'session full';
    end if;

    insert into public.participants (session_id, user_id, display_name, role)
    values (target_session_id, p_user_id, p_display_name, 'audience')
    returning id into target_participant_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'session_id', target_session_id,
    'participant_id', target_participant_id
  );
end;
$$;

comment on function public.join_session(uuid, text, text, integer)
is 'Only server code may call this function so user identity and join validation stay on the server.';

revoke execute on function public.join_session(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.join_session(uuid, text, text, integer) to service_role;
