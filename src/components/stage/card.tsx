import type { HTMLAttributes, ReactNode } from 'react';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & Readonly<{
  children: ReactNode;
  heading?: string;
  headingLevel?: 2 | 3;
}>;

export function Card({
  children,
  className = '',
  heading,
  headingLevel = 2,
  ...sectionProps
}: Props) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <div
      {...sectionProps}
      data-ui="card"
      className={`space-y-4 rounded-sm border border-rule bg-slab p-5 sm:p-6 ${className}`}
    >
      {heading ? (
        <Heading className="font-display text-xl font-semibold text-bone">
          {heading}
        </Heading>
      ) : null}
      {children}
    </div>
  );
}
