import type {ReactNode} from 'react';

type Props = Readonly<{
	children: ReactNode;
	tone?: 'neutral' | 'positive' | 'muted';
}>;

const TONE_CLASSES = {
	neutral: 'border-rule bg-slab-raised text-bone',
	positive: 'border-jade/50 bg-jade/10 text-bone',
	muted: 'border-rule bg-ink text-bone-muted',
} as const;

export function Badge({children, tone = 'neutral'}: Props) {
	return (
		<span
			className={`inline-flex min-h-8 items-center rounded-sm border px-2.5 py-1 text-sm font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
	);
}
