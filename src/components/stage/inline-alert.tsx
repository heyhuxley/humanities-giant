import type {ReactNode} from 'react';

type Props = Readonly<{
	children: ReactNode;
	className?: string;
}>;

export function InlineAlert({children, className = ''}: Props) {
	return (
		<p role="alert"
		   className={`flex items-start gap-3 rounded-sm border border-rose/50 bg-rose/10 p-4 text-bone ${className}`}>
      <span
	      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-rose font-bold text-rose"
	      aria-hidden="true">
        !
      </span>
			<span>{children}</span>
		</p>
	);
}
