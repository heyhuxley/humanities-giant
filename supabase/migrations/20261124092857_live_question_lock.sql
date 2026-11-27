CREATE OR REPLACE FUNCTION private.question_in_live_session(p_question_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_questions AS session_question
    JOIN public.sessions AS session
      ON session.id = session_question.session_id
    WHERE session_question.question_id = p_question_id
      AND session.public_state ->> 'status' IN ('question_active', 'locked', 'revealed')
  );
$$;

COMMENT ON FUNCTION private.question_in_live_session(uuid)
  IS 'Checks whether a question is in a session whose status prevents question edits.';

CREATE OR REPLACE FUNCTION private.guard_live_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.question_in_live_session(OLD.id) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'PJ006',
      MESSAGE = 'question in live session';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.guard_live_question()
  IS 'Prevents updates and deletes to questions used by live sessions.';

CREATE OR REPLACE FUNCTION private.guard_live_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.question_in_live_session(OLD.question_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'PJ006',
      MESSAGE = 'question in live session';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.guard_live_answer()
  IS 'Prevents updates and deletes to answer rows for questions used by live sessions.';

CREATE TRIGGER guard_live_question
BEFORE UPDATE OR DELETE ON public.questions
FOR EACH ROW
EXECUTE FUNCTION private.guard_live_question();

COMMENT ON TRIGGER guard_live_question ON public.questions
  IS 'Prevents updates and deletes to questions used by live sessions.';

CREATE TRIGGER guard_live_answer
BEFORE UPDATE OR DELETE ON public.question_answers
FOR EACH ROW
EXECUTE FUNCTION private.guard_live_answer();

COMMENT ON TRIGGER guard_live_answer ON public.question_answers
  IS 'Prevents updates and deletes to answer rows for questions used by live sessions.';

REVOKE EXECUTE ON FUNCTION private.question_in_live_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.guard_live_question() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.guard_live_answer() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgname = 'guard_live_question'
      AND trigger_row.tgrelid = 'public.questions'::pg_catalog.regclass
      AND NOT trigger_row.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgname = 'guard_live_answer'
      AND trigger_row.tgrelid = 'public.question_answers'::pg_catalog.regclass
      AND NOT trigger_row.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Live question lock trigger verification failed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    JOIN pg_catalog.pg_namespace AS function_schema
      ON function_schema.oid = procedure_row.pronamespace
    WHERE function_schema.nspname = 'private'
      AND procedure_row.proname = 'question_in_live_session'
      AND procedure_row.pronargs = 1
      AND procedure_row.proargtypes[0] = 'pg_catalog.uuid'::pg_catalog.regtype
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    JOIN pg_catalog.pg_namespace AS function_schema
      ON function_schema.oid = procedure_row.pronamespace
    WHERE function_schema.nspname = 'private'
      AND procedure_row.proname = 'guard_live_question'
      AND procedure_row.pronargs = 0
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    JOIN pg_catalog.pg_namespace AS function_schema
      ON function_schema.oid = procedure_row.pronamespace
    WHERE function_schema.nspname = 'private'
      AND procedure_row.proname = 'guard_live_answer'
      AND procedure_row.pronargs = 0
  ) THEN
    RAISE EXCEPTION 'Live question lock function verification failed.';
  END IF;
END;
$$;