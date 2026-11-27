import Link from 'next/link';

type Props = Readonly<{
	title: string;
}>;

export function PageHeader({title}: Props) {
	return (
		<header className="space-y-5 border-b border-rule pb-5">
			<nav aria-label="Host navigation" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
				<Link
					className="min-h-11 inline-flex items-center text-bone-muted underline-offset-4 hover:text-bone hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
					href="/host">
					Home
				</Link>
				<Link
					className="min-h-11 inline-flex items-center text-bone-muted underline-offset-4 hover:text-bone hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
					href="/host/questions">
					Questions
				</Link>
				<Link
					className="min-h-11 inline-flex items-center text-bone-muted underline-offset-4 hover:text-bone hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
					href="/host/sessions">
					Sessions
				</Link>
			</nav>
			<h1 className="break-words font-display text-3xl font-semibold text-bone sm:text-4xl">{title}</h1>
		</header>
	);
}
