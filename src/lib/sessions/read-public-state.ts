import { MONEY_LADDER } from '../../game/constants';
import type { Option } from '../../game/types';
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
  position: number | null;
  amountAtStake: number | null;
  questionEndsAt: number | null;
  contestantId: string | null;
  lockedAnswer: Option | null;
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

function isPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 15;
}

function isLockedAnswer(value: unknown): value is Option {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
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

  const questionInProgress =
    value.status === 'question_active' ||
    value.status === 'locked' ||
    value.status === 'revealed' ||
    value.status === 'finished';
  const position = questionInProgress && isPosition(value.position) ? value.position : null;
  const amountAtStake = position === null ? null : MONEY_LADDER[position - 1] ?? null;
  const questionEndsAt =
    questionInProgress &&
    typeof value.questionEndsAt === 'number' &&
    Number.isFinite(value.questionEndsAt)
      ? value.questionEndsAt
      : null;
  const contestantId =
    questionInProgress &&
    typeof value.contestantId === 'string' &&
    value.contestantId.length > 0
      ? value.contestantId
      : null;
  const lockedAnswer =
    questionInProgress && isLockedAnswer(value.lockedAnswer) ? value.lockedAnswer : null;

  return {
    status: value.status,
    winnings: value.winnings,
    finishReason: value.finishReason,
    position,
    amountAtStake,
    questionEndsAt,
    contestantId,
    lockedAnswer,
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
