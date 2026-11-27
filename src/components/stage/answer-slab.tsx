type Props = Readonly<{
  letter: 'A' | 'B' | 'C' | 'D';
  text: string;
  state: 'neutral' | 'selected' | 'locked' | 'correct' | 'wrong' | 'removed';
  icon?: string;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  ariaPressed?: boolean;
  name?: string;
  value?: string | number;
}>;

function stateStyle(state: Props['state']): string {
  if (state === 'neutral') return 'border-rule bg-slab text-bone hover:bg-slab-raised';
  if (state === 'selected') return 'border-rule border-l-[3px] border-l-ember bg-slab-raised text-bone';
  if (state === 'locked') return 'border-ember bg-slab text-bone';
  if (state === 'correct') return 'border-jade bg-jade/15 text-bone';
  if (state === 'wrong') return 'border-rose bg-rose/15 text-bone';
  return 'border-rule bg-slab text-bone-muted opacity-60';
}

function letterStyle(state: Props['state']): string {
  if (state === 'neutral') return 'bg-slab-raised text-bone-muted';
  if (state === 'selected' || state === 'locked') return 'bg-ember text-ink';
  if (state === 'correct') return 'bg-jade text-ink';
  if (state === 'wrong') return 'bg-rose text-bone';
  return 'bg-slab-raised text-bone-muted';
}

export function AnswerSlab({
  letter,
  text,
  state,
  icon,
  label,
  disabled = false,
  onClick,
  type = 'button',
  ariaPressed,
  name,
  value,
}: Props) {
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={ariaPressed}
      data-slab={letter}
      data-state={state}
      className={`flex min-h-14 w-full items-stretch overflow-hidden rounded-sm border text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-70 transition-[background-color,border-color,color,transform] duration-[120ms] active:scale-[0.98] active:duration-[80ms] ${stateStyle(state)}`}
    >
      <span className={`flex min-h-14 w-14 shrink-0 items-center justify-center font-display text-xl ${letterStyle(state)}`}>
        {letter}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
        <span className={state === 'removed' ? 'break-words line-through' : 'break-words'}>
          {text}
        </span>
        {icon || label ? (
          <span className="flex shrink-0 items-center gap-2 font-semibold">
            {icon ? <span aria-hidden="true">{icon}</span> : null}
            {label ? <span>{label}</span> : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}
