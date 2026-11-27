import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & Readonly<{
  children: ReactNode;
  pending?: boolean;
  pendingText?: string;
  size?: 'normal' | 'large';
  variant?: 'primary' | 'secondary' | 'danger';
}>;

const VARIANT_CLASSES = {
  primary: 'border-ember bg-ember text-ink hover:bg-ember/85',
  secondary: 'border-rule bg-slab text-bone hover:bg-slab-raised',
  danger: 'border-rose bg-rose/10 text-rose hover:bg-rose/20',
} as const;

const SIZE_CLASSES = {
  normal: 'min-h-11 px-4 py-2.5 text-base',
  large: 'min-h-14 px-6 py-3 text-lg',
} as const;

export function Button({
  children,
  className = '',
  disabled,
  pending = false,
  pendingText = 'Working…',
  size = 'normal',
  variant = 'primary',
  ...buttonProps
}: Props) {
  return (
    <button
      {...buttonProps}
      type={buttonProps.type ?? 'button'}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-ui="button"
      className={`press inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {variant === 'danger' ? <span aria-hidden="true">✗</span> : null}
      {pending ? pendingText : children}
    </button>
  );
}
