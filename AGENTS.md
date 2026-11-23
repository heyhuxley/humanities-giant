# AGENTS.md

Rules for any AI agent working in this repo. Read this file and `SPEC.md` before doing anything.

## Source of truth

- `SPEC.md` defines the game: states, events, ladder, lifelines, data model, security rules, pages. It wins over anything else, including your own judgment.
- If the spec is silent or unclear on something you need, **stop and ask**. Do not guess or invent behaviour, states, events, tables or pages.
- Never edit `SPEC.md` or `AGENTS.md` unless the task says to.

## How to work

- Do **one slice at a time**. The task will name the slice (see the build order in `SPEC.md` section 11). Do only that slice.
- Do not build ahead. No files, packages, tables or routes for later slices.
- Touch the smallest number of files you can. Do not refactor, rename or reformat code outside the slice.
- Do not install a new package unless the task names it. If you think one is needed, say why and wait.
- Before you finish, run the type check, lint and tests, and report the results honestly. If something fails or you could not run it, say so. Never claim it works if you did not run it.
- At the end, list: files changed, what each change does, anything you were unsure about, and anything in the spec you think is wrong or missing.

## Stack

- Next.js App Router, TypeScript (strict), Tailwind CSS, Supabase (Postgres, Auth, Realtime).
- No `any`. No ignoring type errors with `@ts-ignore` or `as unknown as`.
- Use Tailwind utility classes. No other CSS framework or component library unless the task names one.
- Do not add Zustand, Redux, TanStack Query or similar. Server state comes from Supabase. Local UI state uses React state.

## Architecture rules

- Game rules live in **one pure module** (no React, no database, no network) that takes the current state and an event and returns either the new state or a rejection. It must have unit tests. The UI and the server both use it. Do not copy the rules anywhere else.
- Only server code changes session state. Clients never write to the `sessions` table directly.
- Every state change is checked against the transition table in `SPEC.md` section 4 before being written.
- Keep database access in one place (a data layer), not scattered through components.
- Components render and call actions. They do not contain game rules.

## Security rules (never break these)

- The correct answer is never sent to a player before the `revealed` state. It must not appear in any query, API response, realtime payload, prop or log a player can reach.
- Correct answers live only in `question_answers`, protected by Row Level Security.
- Host pages and host actions verify a signed-in host on the server. Hiding a button is not security.
- The Supabase service role key is server-only. Never import it into client code, never prefix it with `NEXT_PUBLIC_`, never commit it.
- Participant limits, lifeline use and timer deadlines are enforced on the server, not only in the UI.
- Never commit `.env` files or secrets.

## Conventions

- Files and folders: lowercase with hyphens. Components: PascalCase. Types and interfaces: PascalCase.
- Money is stored as integer naira, never floats.
- Timestamps are stored and compared in UTC.
- Comments explain why, not what.

## Definition of done for any slice

1. It does what the task says and nothing more.
2. It matches `SPEC.md`.
3. Type check, lint and tests pass.
4. No secrets or correct answers leak to the client.
5. Your report lists files changed and open doubts.