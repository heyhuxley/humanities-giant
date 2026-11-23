export type Option = 0 | 1 | 2 | 3;
export type GameStatus = 'waiting' | 'question_active' | 'locked' | 'revealed' | 'finished';
export type FinishReason = 'won' | 'wrong' | 'timeout' | 'walked_away' | 'ended_by_host';
export type LastResult = 'correct' | 'wrong' | 'timeout' | null;

export interface Lifelines {
  fiftyFifty: { used: boolean; usedAtPosition: number | null; removed: [Option, Option] | null };
  phone: { used: boolean; usedAtPosition: number | null; hint: Option | null; hintIsCorrect: boolean | null };
  audience: {
    used: boolean;
    usedAtPosition: number | null;
    percentages: [number, number, number, number] | null;
    notEnoughVotes: boolean;
  };
}

export interface SessionState {
  status: GameStatus;
  position: number;
  contestantId: string | null;
  questionEndsAt: number | null;
  selectedAnswer: Option | null;
  lockedAnswer: Option | null;
  correctIndex: Option | null;
  lastResult: LastResult;
  lifelines: Lifelines;
  winnings: number | null;
  finishReason: FinishReason | null;
}

export type GameEvent =
  | { type: 'set_contestant'; actor: Actor; participantId: string }
  | { type: 'start'; actor: Actor }
  | { type: 'select_answer'; actor: Actor; option: Option }
  | { type: 'lock_in'; actor: Actor }
  | { type: 'timer_expired'; actor: Actor }
  | { type: 'use_lifeline'; actor: Actor; lifeline: LifelineEvent }
  | { type: 'reveal'; actor: Actor; correctIndex: Option }
  | { type: 'next'; actor: Actor }
  | { type: 'walk_away'; actor: Actor }
  | { type: 'end_session'; actor: Actor };

export interface Actor { id: string; role: 'host' | 'contestant' | 'system' }
export type LifelineEvent =
  | { lifeline: 'fifty_fifty'; remove: [Option, Option] }
  | { lifeline: 'phone'; hint: Option; hintIsCorrect: boolean }
  | { lifeline: 'audience'; voteCounts: [number, number, number, number] };

export type GameError = 'wrong_state' | 'not_allowed' | 'deadline_passed' | 'too_early' | 'lifeline_used' | 'invalid_input' | 'no_contestant' | 'nothing_selected';
export type GameResult = { ok: true; state: SessionState } | { ok: false; error: GameError };
