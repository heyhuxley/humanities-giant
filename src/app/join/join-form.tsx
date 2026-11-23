'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { joinSessionAction, type JoinSessionActionState } from './actions';

const INITIAL_STATE: JoinSessionActionState = {
  errors: {},
  formError: null,
  values: { code: '', displayName: '' },
};

export function JoinForm() {
  const [state, formAction, pending] = useActionState(joinSessionAction, INITIAL_STATE);

  return (
    <main className="flex flex-1 items-center justify-center bg-stone-50 px-4 py-12 text-stone-950">
      <section className="w-full max-w-md space-y-8 rounded-2xl border border-stone-200 bg-white p-7 shadow-sm sm:p-9">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Humanities Giant</p>
          <h1 className="text-3xl font-bold tracking-tight">Who Wants to Be a Humanities Giant</h1>
        </header>

        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="code" className="block text-sm font-semibold">Join code</label>
            <input
              id="code"
              name="code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              defaultValue={state.values.code}
              aria-invalid={Boolean(state.errors.code)}
              aria-describedby={state.errors.code ? 'code-hint code-error' : 'code-hint'}
              className="w-full rounded-lg border border-stone-300 px-3 py-3 font-mono text-lg uppercase tracking-[0.2em] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 aria-invalid:border-red-700"
            />
            <p id="code-hint" className="text-sm text-stone-600">Enter the 6 character code.</p>
            {state.errors.code ? <p id="code-error" className="text-sm text-red-800" role="alert">{state.errors.code}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="displayName" className="block text-sm font-semibold">Display name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              required
              defaultValue={state.values.displayName}
              aria-invalid={Boolean(state.errors.displayName)}
              aria-describedby={state.errors.displayName ? 'display-name-error' : undefined}
              className="w-full rounded-lg border border-stone-300 px-3 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 aria-invalid:border-red-700"
            />
            {state.errors.displayName ? <p id="display-name-error" className="text-sm text-red-800" role="alert">{state.errors.displayName}</p> : null}
          </div>

          {state.formError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">{state.formError}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? 'Joining…' : 'Join game'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-600">
          Hosting? <Link href="/host/sign-in" className="font-semibold text-emerald-900 underline underline-offset-4">Host sign in</Link>
        </p>
      </section>
    </main>
  );
}
