export function GiantNumeral({ value }: Readonly<{ value: number }>) {
  return (
    <span
      aria-hidden="true"
      data-stage="numeral"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden font-display text-9xl leading-none text-bone/[0.035]"
    >
      {value}
    </span>
  );
}
