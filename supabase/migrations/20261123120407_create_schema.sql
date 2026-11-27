-- Questions available for hosts to select into quiz sessions.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('english', 'economics', 'government', 'literature')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  text text not null,
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) = 4
    and jsonb_typeof(options -> 0) = 'string'
    and jsonb_typeof(options -> 1) = 'string'
    and jsonb_typeof(options -> 2) = 'string'
    and jsonb_typeof(options -> 3) = 'string'
  ),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index questions_created_by_idx on public.questions (created_by);
alter table public.questions enable row level security;

-- Correct answers are private quiz data and must never be readable by players.
create table public.question_answers (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_index integer not null check (correct_index between 0 and 3)
);
alter table public.question_answers enable row level security;

-- Sessions hold the public state and current question shown to participants.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  public_state jsonb not null,
  current_question jsonb,
  created_at timestamptz not null default now()
);
create index sessions_host_id_idx on public.sessions (host_id);
alter table public.sessions enable row level security;

-- Full engine state is private and must never be readable by players.
create table public.session_private (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  engine_state jsonb not null
);
alter table public.session_private enable row level security;

-- Ordered question selection for each quiz session.
create table public.session_questions (
  session_id uuid not null references public.sessions(id) on delete cascade,
  position integer not null check (position between 1 and 15),
  question_id uuid not null references public.questions(id) on delete restrict,
  primary key (session_id, position),
  unique (session_id, question_id)
);
create index session_questions_question_id_idx on public.session_questions (question_id);
alter table public.session_questions enable row level security;

-- Users participating as contestants or audience members in sessions.
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  role text not null check (role in ('contestant', 'audience')),
  unique (session_id, user_id)
);
create index participants_session_id_idx on public.participants (session_id);
create index participants_user_id_idx on public.participants (user_id);
create unique index participants_one_contestant_per_session_idx
  on public.participants (session_id) where role = 'contestant';
alter table public.participants enable row level security;

-- Audience votes attached to the participant and question position.
create table public.votes (
  session_id uuid not null references public.sessions(id) on delete cascade,
  position integer not null check (position between 1 and 15),
  participant_id uuid not null references public.participants(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  primary key (session_id, position, participant_id),
  foreign key (session_id, position)
    references public.session_questions(session_id, position)
);
create index votes_participant_id_idx on public.votes (participant_id);
alter table public.votes enable row level security;
