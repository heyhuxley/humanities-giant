'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { recordSnapshot, type MotionEvent, type MotionSnapshot } from './motion-plan';

type StageMotionProps = {
  snapshot: MotionSnapshot;
  children: ReactNode;
};

function stableSnapshotKey(snapshot: MotionSnapshot): string {
  return JSON.stringify([
    snapshot.position,
    snapshot.status,
    snapshot.slabs,
    snapshot.lifelineResults.fiftyFifty,
    snapshot.lifelineResults.phone,
    snapshot.lifelineResults.audience,
  ]);
}

// This is intentionally empty. Slice 10c-2 implements the GSAP show motion.
export function runMotion(events: MotionEvent[], rootElement: HTMLDivElement): void {
  void events;
  void rootElement;
}

export function StageMotion({ snapshot, children }: StageMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousSnapshotRef = useRef<MotionSnapshot | null>(null);
  const motionCountRef = useRef(0);
  const snapshotKey = stableSnapshotKey(snapshot);
  const snapshotPosition = snapshot.position;
  const snapshotStatus = snapshot.status;
  const slab0 = snapshot.slabs[0];
  const slab1 = snapshot.slabs[1];
  const slab2 = snapshot.slabs[2];
  const slab3 = snapshot.slabs[3];
  const lifelineFiftyFifty = snapshot.lifelineResults.fiftyFifty;
  const lifelinePhone = snapshot.lifelineResults.phone;
  const lifelineAudience = snapshot.lifelineResults.audience;

  useEffect(() => {
    const rootElement = rootRef.current;
    if (rootElement === null) return;

    const nextSnapshot: MotionSnapshot = {
      position: snapshotPosition,
      status: snapshotStatus,
      slabs: [slab0, slab1, slab2, slab3],
      lifelineResults: {
        fiftyFifty: lifelineFiftyFifty,
        phone: lifelinePhone,
        audience: lifelineAudience,
      },
    };
    const recorded = recordSnapshot(previousSnapshotRef.current, nextSnapshot);
    // In React strict mode, the second effect run sees this identical snapshot.
    previousSnapshotRef.current = recorded.nextPrev;

    if (recorded.events.length === 0) return;

    motionCountRef.current += 1;
    rootElement.setAttribute('data-motion-count', String(motionCountRef.current));
    rootElement.setAttribute('data-last-motion', recorded.events.join(','));
    runMotion(recorded.events, rootElement);
  }, [
    snapshotKey,
    snapshotPosition,
    snapshotStatus,
    slab0,
    slab1,
    slab2,
    slab3,
    lifelineFiftyFifty,
    lifelinePhone,
    lifelineAudience,
  ]);

  return (
    <div ref={rootRef} data-stage-motion>
      {children}
    </div>
  );
}
