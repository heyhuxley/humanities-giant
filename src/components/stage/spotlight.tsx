import type { ReactNode } from 'react';

export function Spotlight({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative isolate">
      <div
        aria-hidden="true"
        data-stage="spotlight"
        className="spotlight pointer-events-none absolute inset-0"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
