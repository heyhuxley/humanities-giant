import type { CurrentQuestion } from './current-question';

export type PublicStatus =
  | 'waiting'
  | 'question_active'
  | 'locked'
  | 'revealed'
  | 'finished';

export type PublicFinishReason =
  | 'won'
  | 'wrong'
  | 'timeout'
  | 'walked_away'
  | 'ended_by_host';

export type SafePublicState = {
  status: PublicStatus;
  winnings: number | null;
  finishReason: PublicFinishReason | null;
};

const STATUSES: ReadonlySet<PublicStatus> = new Set([
  'waiting',
  'question_active',
  'locked',
  'revealed',
  'finished',
]);

const FINISH_REASONS: ReadonlySet<PublicFinishReason> = new Set([
  'won',
  'wrong',
  'timeout',
  'walked_away',
  'ended_by_host',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPublicStatus(value: unknown): value is PublicStatus {
  return typeof value === 'string' && STATUSES.has(value as PublicStatus);
}

function isFinishReason(value: unknown): value is PublicFinishReason {
  return typeof value === 'string' && FINISH_REASONS.has(value as PublicFinishReason);
}

export function readPublicState(value: unknown): SafePublicState | null {
  if (!isRecord(value) || !isPublicStatus(value.status)) return null;
  if (
    value.winnings !== null &&
    (typeof value.winnings !== 'number' ||
      !Number.isSafeInteger(value.winnings) ||
      value.winnings < 0)
  ) {
    return null;
  }
  if (value.finishReason !== null && !isFinishReason(value.finishReason)) return null;

  return {
    status: value.status,
    winnings: value.winnings,
    finishReason: value.finishReason,
  };
}

export function readCurrentQuestion(value: unknown): CurrentQuestion | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.text !== 'string' ||
    value.text.length === 0 ||
    !Array.isArray(value.options) ||
    value.options.length !== 4 ||
    value.options.some((option) => typeof option !== 'string')
  ) {
    return null;
  }

  return {
    id: value.id,
    text: value.text,
    options: [value.options[0], value.options[1], value.options[2], value.options[3]],
  };
}
