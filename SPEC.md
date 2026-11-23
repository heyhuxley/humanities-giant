# Who Wants to Be a Humanities Giant: SPEC v1

This file is the source of truth. If code and spec disagree, the spec wins. If the spec is silent, stop and ask. Do not invent behaviour.

## 1. What it is

A live, host-run quiz show. One host runs a session. One player sits in the hot seat as the **contestant** and answers 15 questions up a naira money ladder. Everyone else is the **audience** and can vote on each question. Players join with a code. Questions come from four subjects: English, Economics, Government, Literature.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime).

Branding and audio are original or royalty-free. No trademarked names, logos or music.

## 2. Roles

| Role | How they get in | Can do |
|---|---|---|
| Host | Supabase Auth (email sign-in) | Manage question bank, create sessions, run a session |
| Contestant | Anonymous sign-in + display name + join code, then chosen by the host | Answer, lock in, use lifelines, walk away |
| Audience | Anonymous sign-in + display name + join code | Watch, vote |

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

| Event | Who | Allowed in | Effect |
|---|---|---|---|
| create_session | Host | n/a | Creates a session with a unique join code and 15 chosen questions |
| join | Anyone with the code | any state except `finished` | Adds a participant (audience by default) |
| set_contestant | Host | `waiting` | Takes a participant ID and marks that participant as contestant, replacing the prior contestant |
| start | Host | `waiting` (contestant set) | Moves to `question_active`, question 1, sets `question_ends_at` to `now + 30000` ms |
| select_answer | Contestant | `question_active` | Stores the tentative choice |
| lock_in | Contestant | `question_active` | Moves to `locked` |
| timer_expired | System (server checks `question_ends_at`) | `question_active` | Moves to `locked` with no answer (counts as wrong) |
| use_lifeline | Contestant | `question_active`, lifeline unused | Applies the lifeline (section 6) |
| vote | Audience | `question_active` | Stores one vote per participant per question (can be changed until locked) |
| reveal | Host | `locked` | Moves to `revealed`, applies outcome |
| next | Host | `revealed`, question was correct, not question 15 | Moves to `question_active`, next question, sets `question_ends_at` to `now + 30000` ms |
| walk_away | Contestant | `revealed`, question was correct | Moves to `finished`, keeps current amount |
| end_session | Host | any non-finished state | Moves to `finished` |

## 5. Money ladder and outcomes

15 questions, amounts in naira.

| Q | Amount | Q | Amount |
|---|---|---|---|
| 1 | 5,000 | 9 | 75,000 |
| 2 | 10,000 | **10** | **100,000** |
| 3 | 15,000 | 11 | 150,000 |
| 4 | 20,000 | 12 | 200,000 |
| **5** | **30,000** | 13 | 300,000 |
| 6 | 40,000 | 14 | 400,000 |
| 7 | 50,000 | 15 | 500,000 |
| 8 | 60,000 | | |

Bold rows are guaranteed milestones (**questions 5 and 10**).

On `reveal`:
- Correct and not question 15: contestant is at that question's amount. Host can press `next`.
- Correct and question 15: game ends with 500,000.
- Wrong or no answer: game ends. Winnings = amount of the last milestone passed (0 if none).
- Walk away: winnings = amount of the last correctly answered question.

## 6. Lifelines

Each of the three lifelines can be used **once per session**, and only by the contestant, only while a question is `question_active`. Use is stored on the session so a refresh cannot reset it.

- **50:50**: removes two wrong options. The removed options are chosen once on the server and stored. Everyone sees the same two options remain.
- **Phone a friend**: shows a canned hint. 60% of the time it points to the correct option, 40% of the time to a wrong option. The outcome is rolled once on the server and stored.
- **Ask the audience**: shows the percentage of audience votes per option for the current question. If fewer than 3 audience votes exist, show the message "Not enough audience votes" and the lifeline is still spent.

Lifeline results are stored in `SessionState`. Audience percentages use the largest remainder method: floor each exact percentage, then distribute remaining points to options with the largest fractional parts, breaking ties by lowest option index. Percentages sum to exactly 100. Check for fewer than 3 votes before calculating percentages; that result is explicitly `not_enough_votes`.

## 6.1 Timer

- Fixed duration per question (constant in code: 30 seconds).
- The server stores `question_ends_at`. Clients compute the remaining time from it locally.
- The server is the authority. Any `lock_in` or `select_answer` after `question_ends_at` is rejected.

## 7. Data model

- `questions`: id, subject (english | economics | government | literature), difficulty, text, options (4 strings), created_by
- `question_answers`: question_id, correct_index. **Never readable by players.**
- `sessions`: id, code, host_id, status, current_position, question_ends_at, contestant_id, lifeline flags (fifty_fifty_used, phone_used, audience_used), stored lifeline results, winnings, created_at
- `session_questions`: session_id, position (1 to 15), question_id
- `participants`: id, session_id, user_id, display_name, role
- `votes`: session_id, position, participant_id, option_index

## 8. Security rules

1. The correct answer is never sent to a player before `revealed`. It lives in `question_answers`, protected by Row Level Security.
2. Players cannot write to `sessions`. All state changes go through server code that checks the transition table in section 4.
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

Leaderboards across sessions, multiple hosts editing one session live, payments or real money, a real phone call for phone a friend, user accounts for players, admin roles beyond host.

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
