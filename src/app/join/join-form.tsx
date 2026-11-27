'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/stage/button';
import { Card } from '../../components/stage/card';
import { Field } from '../../components/stage/field';
import { Spotlight } from '../../components/stage/spotlight';
import { joinSessionAction, type JoinSessionActionState } from './actions';

const INITIAL_STATE: JoinSessionActionState = {
  errors: {},
  formError: null,
  values: { code: '', displayName: '' },
};

export function JoinForm() {
  const [state, formAction, pending] = useActionState(joinSessionAction, INITIAL_STATE);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="film-grain flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 sm:gap-10 sm:py-14"
    >
      <section className="w-full max-w-3xl px-2 py-4 text-center sm:px-6 sm:py-8">
        <Spotlight>
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-semibold leading-tight text-bone text-pretty sm:text-5xl">
              Who Wants to Be a Humanities Giant
            </h1>
            <p className="text-base text-bone-muted">
              Join a live humanities quiz
            </p>
          </div>
        </Spotlight>
      </section>

      <Card className="w-full max-w-lg">
        <form action={formAction} className="space-y-5">
          <Field
            id="code"
            name="code"
            label="Join code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            defaultValue={state.values.code}
            aria-invalid={Boolean(state.errors.code)}
            aria-describedby={state.errors.code ? 'code-hint code-error' : 'code-hint'}
            helperText="Enter the 6 character code."
            error={state.errors.code}
            errorId="code-error"
            inputClassName="min-h-16 font-display text-3xl uppercase tracking-[0.28em]"
          />

          <Field
            id="displayName"
            name="displayName"
            label="Display name"
            type="text"
            autoComplete="nickname"
            required
            defaultValue={state.values.displayName}
            aria-invalid={Boolean(state.errors.displayName)}
            aria-describedby={state.errors.displayName ? 'display-name-error' : undefined}
            error={state.errors.displayName}
            errorId="display-name-error"
          />

          {state.formError ? (
            <p role="alert" className="flex items-start gap-2 border border-rose/50 bg-rose/10 p-3 text-sm text-rose">
              <svg
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 6.5v4.25m0 2.75h.01" />
              </svg>
              <span>{state.formError}</span>
            </p>
          ) : null}

          <Button
            type="submit"
            pending={pending}
            pendingText="Joining…"
            size="large"
            className="w-full"
          >
            Join game
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-bone-muted">
        Hosting?{' '}
        <Link
          href="/host/sign-in"
          className="font-semibold text-bone underline decoration-ember underline-offset-4 hover:text-ember"
        >
          Host sign in
        </Link>
      </p>
    </main>
  );
}
