# Who Wants to Be a Humanities Giant: SPEC v1

This file is the source of truth. If code and spec disagree, the spec wins. If the spec is silent, stop and ask. Do not
invent behaviour.

## 1. What it is

A live, host-run quiz show. One host runs a session. One player sits in the hot seat as the **contestant** and answers
15 questions up a naira money ladder. Everyone else is the **audience** and can vote on each question. Players join with
a code. Questions come from four subjects: English, Economics, Government, Literature.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime).

Branding and audio are original or royalty-free. No trademarked names, logos or music.

## 2. Roles

| Role       | How they get in                                                       | Can do                                               |
|------------|-----------------------------------------------------------------------|------------------------------------------------------|
| Host       | Supabase Auth (email sign-in)                                         | Manage question bank, create sessions, run a session |
| Contestant | Anonymous sign-in + display name + join code, then chosen by the host | Answer, lock in, use lifelines, walk away            |
| Audience   | Anonymous sign-in + display name + join code                          | Watch, vote                                          |

Host-only pages are protected on the server, not just hidden in the UI.

## 3. Session state machine

```
waiting -> question_active -> locked -> revealed -> question_active (next question)
                                                 -> finished
```

- `waiting`: players are joining, host has not started. The host picks the contestant here.
- `question_active`: question is shown, countdown running (`question_ends_at`).
- `locked`: contestant locked in an answer, or the timer expired. No more changes to the answer.
- `revealed`: correct answer is shown, outcome applied (see section 5).
- `finished`: game is over. Final winnings are stored. Results page is shown.

No other states exist.

## 4. Events

Every event is validated on the server against the current state. Anything not in this table is rejected.

| Event          | Who                                       | Allowed in                                        | Effect                                                                                          |
|----------------|-------------------------------------------|---------------------------------------------------|-------------------------------------------------------------------------------------------------|
| create_session | Host                                      | n/a                                               | Creates a session with a unique join code and 15 chosen questions                               |
| join           | Anyone with the code                      | any state except `finished`                       | Adds a participant (audience by default)                                                        |
| set_contestant | Host                                      | `waiting`                                         | Takes a participant ID and marks that participant as contestant, replacing the prior contestant |
| start          | Host                                      | `waiting` (contestant set)                        | Moves to `question_active`, question 1, sets `question_ends_at` to `now + 30000` ms             |
| select_answer  | Contestant                                | `question_active`                                 | Stores the tentative choice                                                                     |
| lock_in        | Contestant                                | `question_active`                                 | Moves to `locked`                                                                               |
| timer_expired  | System (server checks `question_ends_at`) | `question_active`                                 | Moves to `locked` with no answer (counts as wrong)                                              |
| use_lifeline   | Contestant                                | `question_active`, lifeline unused                | Applies the lifeline (section 6)                                                                |
| vote           | Audience                                  | `question_active`                                 | Stores one vote per participant per question (can be changed until locked)                      |
| reveal         | Host                                      | `locked`                                          | Moves to `revealed`, applies outcome                                                            |
| next           | Host                                      | `revealed`, question was correct, not question 15 | Moves to `question_active`, next question, sets `question_ends_at` to `now + 30000` ms          |
| walk_away      | Contestant                                | `revealed`, question was correct                  | Moves to `finished`, keeps current amount                                                       |
| end_session    | Host                                      | any non-finished state                            | Moves to `finished`                                                                             |

## 5. Money ladder and outcomes

15 questions, amounts in naira.

| Q     | Amount     | Q      | Amount      |
|-------|------------|--------|-------------|
| 1     | 5,000      | 9      | 75,000      |
| 2     | 10,000     | **10** | **100,000** |
| 3     | 15,000     | 11     | 150,000     |
| 4     | 20,000     | 12     | 200,000     |
| **5** | **30,000** | 13     | 300,000     |
| 6     | 40,000     | 14     | 400,000     |
| 7     | 50,000     | 15     | 500,000     |
| 8     | 60,000     |        |             |

Bold rows are guaranteed milestones (**questions 5 and 10**).

On `reveal`:

- Correct and not question 15: contestant is at that question's amount. Host can press `next`.
- Correct and question 15: game ends with 500,000.
- Wrong or no answer: game ends. Winnings = amount of the last milestone passed (0 if none).
- Walk away: winnings = amount of the last correctly answered question.

## 6. Lifelines

Each of the three lifelines can be used **once per session**, and only by the contestant, only while a question is
`question_active`. Use is stored on the session so a refresh cannot reset it.

- **50:50**: removes two wrong options. The removed options are chosen once on the server and stored. Everyone sees the
  same two options remain.
- **Phone a friend**: shows a canned hint. 60% of the time it points to the correct option, 40% of the time to a wrong
  option. The outcome is rolled once on the server and stored.
- **Ask the audience**: shows the percentage of audience votes per option for the current question. If fewer than 3
  audience votes exist, show the message "Not enough audience votes" and the lifeline is still spent.

Lifeline results are stored in `SessionState`. Audience percentages use the largest remainder method: floor each exact
percentage, then distribute remaining points to options with the largest fractional parts, breaking ties by lowest
option index. Percentages sum to exactly 100. Check for fewer than 3 votes before calculating percentages; that result
is explicitly `not_enough_votes`.

## 6.1 Timer

- Fixed duration per question (constant in code: 30 seconds).
- The server stores `question_ends_at`. Clients compute the remaining time from it locally.
- The server is the authority. Any `lock_in` or `select_answer` after `question_ends_at` is rejected.

## 7. Data model

- `questions`: id, subject (english | economics | government | literature), difficulty, text, options (4 strings),
  created_by
- `question_answers`: question_id, correct_index. **Never readable by players.**
- `sessions`: id, code, host_id, status, current_position, question_ends_at, contestant_id, lifeline flags
  (fifty_fifty_used, phone_used, audience_used), stored lifeline results, winnings, created_at
- `session_questions`: session_id, position (1 to 15), question_id
- `participants`: id, session_id, user_id, display_name, role
- `votes`: session_id, position, participant_id, option_index

## 8. Security rules

1. The correct answer is never sent to a player before `revealed`. It lives in `question_answers`, protected by Row
   Level Security.
2. Players cannot write to `sessions`. All state changes go through server code that checks the transition table in
   section 4.
3. Host-only pages and actions verify a signed-in host on the server.
4. Join code is unique and not guessable (6 characters). A session stops accepting joins when `finished`.
5. Participant limits are enforced on the server, not only in the UI.

## 9. Pages

1. **Home**: create a session (host) or enter a code and name (player)
2. **Host sign-in**
3. **Waiting room**: live list of joined players, host picks contestant and starts
4. **Contestant screen**: question, four options, countdown, lifelines, money ladder
5. **Audience screen**: same question view, vote buttons, ladder
6. **Host control screen**: current state, reveal, next, end session
7. **Question bank** (host only): list, create, edit, delete, filter by subject and difficulty
8. **Create session** (host only): choose exactly 15 questions from the bank, ordered by position
9. **Results**: final winnings and a short recap

## 10. Out of scope for v1

Leaderboards across sessions, multiple hosts editing one session live, payments or real money, a real phone call for
phone a friend, user accounts for players, admin roles beyond host.

## 11. Build order (one slice at a time, each verified before the next)

1. Project setup and `AGENTS.md`
2. Pure transition logic (section 4) with unit tests, no UI, no database
3. Database tables, RLS policies, seed questions
4. Host auth and question bank
5. Create session and join flow
6. Waiting room with realtime presence
7. Contestant and audience screens with the countdown
8. Lifelines
9. Host control screen and results
10. Styling, animation, sound

## 12. Engine data shapes

### 12.1 Conventions

- `applyEvent(state, event, now)`: `now` is epoch milliseconds (UTC), passed in, never read from a clock.
- Money is integer naira. Option indexes are `0 | 1 | 2 | 3` (A to D). `position` is 1 to 15.
- The engine never receives or stores the correct answer before `reveal`.
- `createInitialState()` returns a fresh `waiting` state (a pure function).

### 12.2 SessionState

| Field          | Type                                                              | Meaning                                          |
|----------------|-------------------------------------------------------------------|--------------------------------------------------|
| status         | `waiting \| question_active \| locked \| revealed \| finished`    | Current state                                    |
| position       | number                                                            | 0 while `waiting`, then 1 to 15                  |
| contestantId   | string \| null                                                    | Chosen contestant                                |
| questionEndsAt | number \| null                                                    | Deadline (epoch ms) for the active question      |
| selectedAnswer | option \| null                                                    | Tentative choice                                 |
| lockedAnswer   | option \| null                                                    | Locked choice. Stays null after a timeout        |
| correctIndex   | option \| null                                                    | **Null until `reveal`**, then the correct option |
| lastResult     | `correct \| wrong \| timeout \| null`                             | Result of the revealed question                  |
| lifelines      | see 12.3                                                          | Used flags and stored results                    |
| winnings       | number \| null                                                    | Null until `finished`                            |
| finishReason   | `won \| wrong \| timeout \| walked_away \| ended_by_host \| null` | Why the game ended                               |

### 12.3 Lifelines

```
lifelines: {
  fiftyFifty: { used: boolean, usedAtPosition: number | null, removed: [option, option] | null }
  phone:      { used: boolean, usedAtPosition: number | null, hint: option | null, hintIsCorrect: boolean | null }
  audience:   { used: boolean, usedAtPosition: number | null, percentages: [n, n, n, n] | null, notEnoughVotes: boolean }
}
```

A stored result applies only to the question at `usedAtPosition`. Used flags last for the whole session.

### 12.4 Events

Every event carries `actor: { id: string, role: 'host' | 'contestant' | 'system' }`.

| Event          | Extra fields  | Allowed actor                           | Allowed in                |
|----------------|---------------|-----------------------------------------|---------------------------|
| set_contestant | participantId | host                                    | waiting                   |
| start          | none          | host                                    | waiting (contestant set)  |
| select_answer  | option        | contestant (id must equal contestantId) | question_active           |
| lock_in        | none          | contestant                              | question_active           |
| timer_expired  | none          | system                                  | question_active           |
| use_lifeline   | see 12.5      | contestant                              | question_active           |
| reveal         | correctIndex  | host                                    | locked                    |
| next           | none          | host                                    | revealed                  |
| walk_away      | none          | contestant                              | revealed (result correct) |
| end_session    | none          | host                                    | any state except finished |

### 12.5 use_lifeline variants

- `{ lifeline: 'fifty_fifty', remove: [option, option] }`: two different options. The caller guarantees neither is the
  correct one (the engine cannot know). The engine checks only that they are valid and distinct.
- `{ lifeline: 'phone', hint: option, hintIsCorrect: boolean }`
- `{ lifeline: 'audience', voteCounts: [n, n, n, n] }`: non-negative integers. The engine computes percentages with the
  largest remainder method (section 6) and sets `notEnoughVotes` when the total is under 3.

### 12.6 Time rules

- `select_answer`, `lock_in`, `use_lifeline` are accepted only if `now < questionEndsAt`.
- `timer_expired` is accepted only if `now >= questionEndsAt`. It moves to `locked` with `lockedAnswer` null.
- `start` and `next` set `questionEndsAt = now + 30000`.

### 12.7 Transition effects

- `start`: position 1, status `question_active`.
- `next`: position + 1, clears `selectedAnswer`, `lockedAnswer`, `correctIndex`, `lastResult`. Lifeline flags stay.
- `lock_in`: `lockedAnswer = selectedAnswer`. Rejected if nothing is selected.
- `reveal`: sets `correctIndex` and `lastResult`.
    - Correct and position < 15: status `revealed`.
    - Correct at position 15: status `finished`, reason `won`, winnings 500000.
    - Wrong or timeout: status `finished`, reason `wrong` or `timeout`, winnings per 12.8.
    - On `finished`, the answer fields stay filled so the UI can still show the reveal.
- `walk_away`: status `finished`, reason `walked_away`, winnings = amount of the current position.
- `end_session`: status `finished`, reason `ended_by_host`, winnings = last correctly answered amount (0 if none).

### 12.8 Winnings on a loss

Wrong or timeout at position p pays the amount of the highest milestone below p. A milestone counts only once its
question is answered correctly.

- p 1 to 5: 0
- p 6 to 10: 30000
- p 11 to 15: 100000

### 12.9 Errors

A rejection returns `{ ok: false, error }` with one of: `wrong_state`, `not_allowed`, `deadline_passed`, `too_early`,
`lifeline_used`, `invalid_input`, `no_contestant`, `nothing_selected`.

### 12.10 Out of scope

Replacing the contestant after `waiting`. If the contestant leaves, the host ends the session.

## 13. Database schema and access rules

### 13.1 Tables

- `questions`: id (uuid), subject (english | economics | government | literature), difficulty (easy | medium | hard),
  text, options (jsonb array of exactly 4 strings), created_by (uuid, auth user), created_at
- `question_answers`: question_id (pk, references questions, cascade), correct_index (0 to 3)
- `sessions`: id (uuid), code (unique, 6 characters), host_id (uuid), public_state (jsonb, engine state with
  hintIsCorrect set to null), current_question (jsonb: id, text, options only, or null), created_at
- `session_private`: session_id (pk, references sessions, cascade), engine_state (jsonb, the full engine state)
- `session_questions`: session_id, position (1 to 15), question_id. Primary key (session_id, position)
- `participants`: id (uuid), session_id, user_id (uuid), display_name, role (contestant | audience). Unique (session_id,
  user_id)
- `votes`: session_id, position, participant_id, option_index (0 to 3). Primary key (session_id, position,
  participant_id)

### 13.2 Access rules (RLS on every table)

- Hosts are signed-in, non-anonymous users. Players are anonymous users.
- `questions`: a host can create, read, update and delete only rows they created. Players: no access.
- `question_answers`: same host rule through the question's owner. Players: no access, ever.
- `sessions`: a user can read a session if they are its host or one of its participants. No client writes.
- `participants`: a user can read participants of any session they belong to. No client writes.
- `session_questions`: the session's host can read. No client writes.
- `session_private` and `votes`: no client access. Server only.
- All writes to sessions, session_private, session_questions, participants and votes go through server code using the
  service role.

### 13.3 Flow rules

- On `start` and `next`, the server copies the new question's id, text and options (never the answer) into
  `sessions.current_question`.
- On `reveal`, the server reads the correct index from `question_answers`, runs `applyEvent`, then writes the new full
  state to `session_private` and the public copy to `sessions.public_state`.
- Realtime is enabled on `sessions` and `participants` only.
- All schema changes are SQL files in `supabase/migrations/`. Never edit the database by hand without a matching
  migration.

## 14. Session creation and joining

### 14.1 Join codes

- 6 characters from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L), generated with a cryptographic
  random source.
- Player input is normalised before lookup: trimmed, uppercased, spaces and hyphens removed. Anything not matching 6
  valid characters is rejected before touching the database.
- If a generated code already exists, the server retries up to 5 times with a new code.

### 14.2 Creating a session (host)

- Requires a signed-in host.
- The host supplies exactly 15 distinct question ids, in order. Position 1 is the first.
- Every question must belong to the host and have an answer row. Otherwise nothing is created.
- A new session starts in `waiting` with the engine's initial state. The full state goes in
  `session_private.engine_state` and the stripped copy in `sessions.public_state`.
- All four writes happen in one database transaction. The function that does this is callable by the service role only.

### 14.3 Joining (player)

- Needs a display name (1 to 30 characters after trimming) and a valid code.
- The server signs the player in anonymously (or reuses their existing anonymous login), then adds a `participants` row
  with role `audience`.
- Joining the same session twice with the same login reuses the same row and updates the display name.
- A signed-in host cannot join as a player.
- Joining is refused if the session is `finished` or already has 100 audience members. The same generic message is shown
  for "no such code" and "session finished".
- Contestant selection happens later, in the waiting room, through the engine's `set_contestant` event.

**## 15. Host role

- A host is a user whose JWT has `app_metadata.role = 'host'` and whose `is_anonymous` claim is not true. Users cannot
  change `app_metadata`.
- Hosts are created by the project owner. The role is set with SQL in the dashboard. There is no sign-up or self-service
  path to the role.
- Public sign-ups stay enabled because anonymous sign-in requires them. An account created by anyone else has no role
  and can do nothing.
- Every RLS policy and server check that says "host" uses this definition.
- The join action refuses any signed-in user who is not anonymous.**

## 16. Transitions and live updates

### 16.1 Who is the caller

- The server identifies the caller from the verified login (never from form fields).
- Host events: the caller must hold the host role (section 15) and own the session.
- Contestant events: the server finds the caller's participants row in that session. The engine actor is
  `{ id: <that participant id>, role: 'contestant' }`. `contestantId` in the engine state is a participant id.

### 16.2 Running an event

1. Load `session_private` (engine_state and version) with the admin client.
2. Call `applyEvent(state, event, Date.now())`.
3. If the engine rejects, return the engine's error code to the caller. Nothing is written.
4. If it accepts, commit through the `commit_transition` function.

### 16.3 commit_transition

- Callable by the service role only. One transaction.
- Updates `session_private.engine_state` and increments `version`, only where `version` equals the version read in 16.2.
  If no row matches, it raises error code PJ003 (conflict).
- Updates `sessions.public_state` (the toPublicState copy) and `sessions.current_question`.
- When the event is `set_contestant`, it also sets the previous contestant's participants.role to `audience` and the new
  contestant's to `contestant`.

### 16.4 Conflicts

On PJ003 the server reloads and tries again once. The engine decides again on the fresh state, so an event that is no
longer valid is rejected normally. A second conflict returns a "try again" error.

### 16.5 current_question

Set to `{ id, text, options }` of the question at the current position when the status becomes `question_active`. Never
contains the correct answer. It stays set through `locked`, `revealed` and `finished`, so the reveal screen can show the
question. At `finished` it keeps the last stored question, or is null if the session ended before any question was
shown. It is cleared only in `waiting`.

### 16.6 Live updates

- Clients subscribe to the `sessions` row for their session and to `participants` for their session, with Postgres
  Changes. RLS limits what each client receives.
- Pattern: subscribe, then fetch current data, then apply changes. On every reconnect, fetch again. Missed events are
  never assumed to arrive.
- The waiting-room roster is the `participants` table. Presence is not used in v1.
- Accepted for v1: realtime payloads include `user_id` for participants in the same session.
-
    - Realtime events are only a signal to refresh. The app never reads data from an event payload. On any event, or
      when the channel (re)subscribes, the page refreshes and reads current data through the normal server reads.
- Bursts of events are collapsed into one refresh (about 300 ms trailing).
- If the channel is not live (error, timeout or closed), the page shows a "Reconnecting" notice and refreshes every 5
  seconds until live again. It also refreshes when the tab becomes visible and when the browser comes back online.

## 17. Question lock

- A question is locked while any session that contains it has status `question_active`, `locked` or `revealed`.
- A locked question cannot be updated or deleted, and neither can its `question_answers` row. This is enforced by database triggers, for every role including the service role.
- Questions in sessions that are `waiting` or `finished` may be edited. Deleting a question that appears in any session, finished or not, stays blocked by the foreign key.
- The trigger raises error code `PJ006`. The app shows: "This question is in a live session and can't be changed until the session finishes."
- A session in a live status stays live until its status becomes `finished`. Ending a session is done with the engine's `end_session` event.

## 18. Answering, voting and the timer

### 18.1 Who may do what
- Contestant: submit a final answer (select then lock in, run together), use lifelines.
- Audience (participants with role audience): vote. The contestant and the host cannot vote.
- Host: reveal, next, end session.
- Anyone who can read the session (a participant or its host) may send the timer knock.

### 18.2 Contestant answers
- The tentative choice lives only in the contestant's browser. The server receives one submit action that runs `select_answer` then `lock_in`.
- Neither the engine state nor the public state carries a pick before it is locked, except for the instant between the two commits.
- The locked answer is visible to everyone before the reveal.

### 18.3 Timer
- `timer_expired` is sent by the server on behalf of a "system" actor when any client or the host page knocks. The engine accepts it only when `now >= questionEndsAt`.
- Clients start knocking when their server-adjusted countdown reaches zero, and the host page repeats the knock every 2 seconds while the status is `question_active` and the deadline has passed.
- Each page render includes the server's current time so clients can correct for clock differences. The server deadline is the only authority.

### 18.4 Votes
- Stored in `votes` (session, position, participant, option). One row per participant per question; a later vote replaces the earlier one.
- A vote is accepted only when the session is `question_active`, the deadline has not passed, the voter is an audience participant of that session, and the option is 0 to 3.
- Votes are never readable by clients. They are counted by the server only for the "ask the audience" lifeline.

### 18.5 Reveal
- The host sends a reveal request with no answer in it. The server runner reads the correct index for the current position only after confirming ownership and that the session is `locked`.
- The answer is stored in the engine state and the public state only from the `revealed` or `finished` status.
- Code that reads `question_answers` is limited to one server-only file plus the host question bank.\

### 18.6 Player actions
- The caller's identity comes from the verified server-side claims, never from form fields. Form fields carry only the session id and, for answers and votes, an option 0 to 3.
- Submit answer: the server finds the caller's participant row for that session and uses its id as the contestant actor. It runs `select_answer` then `lock_in`. If `lock_in` fails after `select_answer` succeeded, the failure is shown and the contestant may submit again.
- Vote: the verified user id and the option go to the vote function. Only audience participants can vote.
- Timer knock: allowed for any caller who can read the session through their own access rules (a participant or the host). The server sends `timer_expired` with the system actor. An early or repeated knock is a harmless no-op, not an error.
- Timer knocks and votes are not rate limited in v1 (see the v2 list).
