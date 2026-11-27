import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & Readonly<{
  error?: string;
  errorId?: string;
  helperText?: string;
  id: string;
  inputClassName?: string;
  label: string;
}>;

export function Field({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className = '',
  error,
  errorId,
  helperText,
  id,
  inputClassName = '',
  label,
  ...inputProps
}: Props) {
  const helperId = helperText ? `${id}-hint` : undefined;
  const messageId = error ? errorId ?? `${id}-error` : undefined;
  const describedBy = [...new Set([
    ...(ariaDescribedBy?.split(/\s+/) ?? []),
    helperId,
    messageId,
  ].filter((value): value is string => Boolean(value)))].join(' ') || undefined;

  return (
    <div data-ui="field" className={`space-y-2 ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-bone">
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={Boolean(error) || ariaInvalid}
        aria-describedby={describedBy}
        className={`min-h-12 w-full rounded-sm border border-rule bg-ink px-4 py-3 text-base text-bone outline-none placeholder:text-bone-muted focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember aria-invalid:border-rose ${inputClassName}`}
      />
      {helperText ? (
        <p id={helperId} className="text-sm text-bone-muted">
          {helperText}
        </p>
      ) : null}
      {error && messageId ? (
        <p id={messageId} role="alert" className="flex items-start gap-2 text-sm text-rose">
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
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
