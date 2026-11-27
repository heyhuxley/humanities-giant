export type SlabView = 'neutral' | 'locked' | 'correct' | 'wrong' | 'removed';

export type MotionStatus =
  | 'waiting'
  | 'question_active'
  | 'locked'
  | 'revealed'
  | 'finished'
  | 'unknown';

export type MotionSnapshot = {
  position: number;
  status: MotionStatus;
  slabs: [SlabView, SlabView, SlabView, SlabView];
  lifelineResults: {
    fiftyFifty: boolean;
    phone: boolean;
    audience: boolean;
  };
};

export type MotionEvent =
  | 'question_enter'
  | 'lock_in'
  | 'reveal_correct'
  | 'reveal_wrong'
  | 'reveal_timeout'
  | 'ladder_step'
  | 'final_result'
  | 'fifty_fifty'
  | 'lifeline_phone'
  | 'lifeline_audience';

const STATUS_ORDER: Record<MotionStatus, number> = {
  waiting: 0,
  question_active: 1,
  locked: 2,
  revealed: 3,
  finished: 4,
  unknown: -1,
};

function copySnapshot(snapshot: MotionSnapshot): MotionSnapshot {
  return {
    position: snapshot.position,
    status: snapshot.status,
    slabs: [
      snapshot.slabs[0],
      snapshot.slabs[1],
      snapshot.slabs[2],
      snapshot.slabs[3],
    ],
    lifelineResults: {
      fiftyFifty: snapshot.lifelineResults.fiftyFifty,
      phone: snapshot.lifelineResults.phone,
      audience: snapshot.lifelineResults.audience,
    },
  };
}

export function snapshotsEqual(a: MotionSnapshot, b: MotionSnapshot): boolean {
  return (
    a.position === b.position &&
    a.status === b.status &&
    a.slabs[0] === b.slabs[0] &&
    a.slabs[1] === b.slabs[1] &&
    a.slabs[2] === b.slabs[2] &&
    a.slabs[3] === b.slabs[3] &&
    a.lifelineResults.fiftyFifty === b.lifelineResults.fiftyFifty &&
    a.lifelineResults.phone === b.lifelineResults.phone &&
    a.lifelineResults.audience === b.lifelineResults.audience
  );
}

function statusIsLegalStep(prev: MotionSnapshot, next: MotionSnapshot): boolean {
  if (prev.position !== next.position) return false;
  if (prev.status === next.status) return true;
  if (prev.status === 'unknown' || next.status === 'unknown') return false;

  if (next.status === 'question_active') return prev.status === 'waiting';
  if (next.status === 'locked') return prev.status === 'question_active';
  if (next.status === 'revealed' || next.status === 'finished') {
    return prev.status === 'question_active' ||
      prev.status === 'locked' ||
      prev.status === 'revealed';
  }
  return false;
}

function revealEvent(prev: MotionSnapshot, next: MotionSnapshot): MotionEvent | null {
  if (next.slabs.includes('wrong')) return 'reveal_wrong';

  const hasCorrect = next.slabs.includes('correct');
  if (!hasCorrect) return null;

  const previousLocked = prev.slabs.includes('locked');
  if (previousLocked) return 'reveal_correct';
  return 'reveal_timeout';
}

export function recordSnapshot(
  prev: MotionSnapshot | null,
  next: MotionSnapshot,
): { events: MotionEvent[]; nextPrev: MotionSnapshot } {
  return {
    events: planMotion(prev, next),
    nextPrev: copySnapshot(next),
  };
}

export function planMotion(
  prev: MotionSnapshot | null,
  next: MotionSnapshot,
): MotionEvent[] {
  if (prev === null) return [];
  if (snapshotsEqual(prev, next)) return [];
  if (next.status === 'unknown') return [];

  const events: MotionEvent[] = [];
  const positionChanged = next.position !== prev.position;

  if (next.position < prev.position) return [];
  if (next.position - prev.position > 1) return [];
  if (prev.position === 0 && next.position === 1 && next.status !== 'question_active') return [];

  const statusAdvanced = STATUS_ORDER[next.status] > STATUS_ORDER[prev.status];
  const statusWentBack = STATUS_ORDER[next.status] < STATUS_ORDER[prev.status];
  if (positionChanged) {
    if (next.position === prev.position + 1 && next.status === 'question_active') {
      events.push('question_enter');
      return events;
    }
    return [];
  }

  if (statusWentBack) return [];
  if (prev.status === 'unknown') return [];

  if (!statusIsLegalStep(prev, next)) return [];

  if (
    prev.status === 'question_active' &&
    next.status === 'locked'
  ) {
    events.push('lock_in');
  } else if (
    (prev.status === 'question_active' || prev.status === 'locked') &&
    (next.status === 'revealed' || next.status === 'finished')
  ) {
    const reveal = revealEvent(prev, next);
    if (reveal !== null) events.push(reveal);
    if (reveal === 'reveal_correct' && next.status === 'revealed') {
      events.push('ladder_step');
    }
    if (next.status === 'finished') {
      if (reveal !== null || reveal === null) events.push('final_result');
    }
  } else if (
    prev.status === 'revealed' &&
    next.status === 'finished'
  ) {
    events.push('final_result');
  }

  if (!positionChanged && (next.status === prev.status || statusAdvanced)) {
    if (!events.includes('question_enter')) {
      if (!prev.lifelineResults.fiftyFifty && next.lifelineResults.fiftyFifty) {
        events.push('fifty_fifty');
      }
      if (!prev.lifelineResults.phone && next.lifelineResults.phone) {
        events.push('lifeline_phone');
      }
      if (!prev.lifelineResults.audience && next.lifelineResults.audience) {
        events.push('lifeline_audience');
      }
    }
  }

  return events;
}
