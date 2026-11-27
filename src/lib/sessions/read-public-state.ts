import { MONEY_LADDER } from '../../game/constants';
import type { LastResult, Option } from '../../game/types';
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

export type PublicLifelineUsage = {
  used: boolean;
  usedAtPosition: number | null;
};

export type PublicLifelines = {
  fiftyFifty: PublicLifelineUsage & { removed: [Option, Option] | null };
  phone: PublicLifelineUsage & { hint: Option | null };
  audience: PublicLifelineUsage & {
    percentages: [number, number, number, number] | null;
    notEnoughVotes: boolean;
  };
};

export type SafePublicState = {
  status: PublicStatus;
  winnings: number | null;
  finishReason: PublicFinishReason | null;
  position: number | null;
  amountAtStake: number | null;
  questionEndsAt: number | null;
  contestantId: string | null;
  lockedAnswer: Option | null;
  correctIndex: Option | null;
  lastResult: LastResult;
  lifelines: PublicLifelines;
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

function isLastResult(value: unknown): value is Exclude<LastResult, null> {
  return value === 'correct' || value === 'wrong' || value === 'timeout';
}

function readLifelineUsage(value: unknown): PublicLifelineUsage {
  if (!isRecord(value)) return { used: false, usedAtPosition: null };
  return {
    used: value.used === true,
    usedAtPosition: isPosition(value.usedAtPosition) ? value.usedAtPosition : null,
  };
}

function readOption(value: unknown): Option | null {
  return isLockedAnswer(value) ? value : null;
}

function readRemovedOptions(value: unknown): [Option, Option] | null {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !isLockedAnswer(value[0]) ||
    !isLockedAnswer(value[1]) ||
    value[0] === value[1]
  ) {
    return null;
  }
  return value[0] < value[1] ? [value[0], value[1]] : [value[1], value[0]];
}

function readAudiencePercentages(value: unknown): [number, number, number, number] | null {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((percentage) =>
      typeof percentage !== 'number' ||
      !Number.isInteger(percentage) ||
      percentage < 0 ||
      percentage > 100)
  ) {
    return null;
  }

  const percentages: [number, number, number, number] = [
    value[0],
    value[1],
    value[2],
    value[3],
  ];
  return percentages.reduce((total, percentage) => total + percentage, 0) === 100
    ? percentages
    : null;
}

function resultApplies(
  usage: PublicLifelineUsage,
  position: number | null,
  status: PublicStatus,
): boolean {
  return (
    usage.used &&
    position !== null &&
    usage.usedAtPosition === position &&
    status !== 'waiting'
  );
}

function readLifelines(
  value: unknown,
  position: number | null,
  status: PublicStatus,
): PublicLifelines {
  const resultIsAvailable =
    status === 'question_active' ||
    status === 'locked' ||
    status === 'revealed' ||
    status === 'finished';
  if (!isRecord(value)) {
    return {
      fiftyFifty: { ...readLifelineUsage(null), removed: null },
      phone: { ...readLifelineUsage(null), hint: null },
      audience: {
        ...readLifelineUsage(null),
        percentages: null,
        notEnoughVotes: false,
      },
    };
  }
  const fiftyFifty = readLifelineUsage(value.fiftyFifty);
  const phone = readLifelineUsage(value.phone);
  const audience = readLifelineUsage(value.audience);
  const fiftyFiftyApplies = resultIsAvailable && resultApplies(fiftyFifty, position, status);
  const phoneApplies = resultIsAvailable && resultApplies(phone, position, status);
  const audienceApplies = resultIsAvailable && resultApplies(audience, position, status);

  const fiftyFiftyResult = isRecord(value.fiftyFifty) ? value.fiftyFifty : null;
  const phoneResult = isRecord(value.phone) ? value.phone : null;
  const audienceResult = isRecord(value.audience) ? value.audience : null;

  return {
    fiftyFifty: {
      ...fiftyFifty,
      removed: fiftyFiftyApplies
        ? readRemovedOptions(fiftyFiftyResult?.removed)
        : null,
    },
    phone: {
      ...phone,
      hint: phoneApplies ? readOption(phoneResult?.hint) : null,
    },
    audience: {
      ...audience,
      percentages: audienceApplies
        ? readAudiencePercentages(audienceResult?.percentages)
        : null,
      notEnoughVotes: audienceApplies && audienceResult?.notEnoughVotes === true,
    },
  };
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
  const revealAvailable = value.status === 'revealed' || value.status === 'finished';
  const correctIndex =
    revealAvailable && isLockedAnswer(value.correctIndex) ? value.correctIndex : null;
  const lastResult =
    revealAvailable && isLastResult(value.lastResult) ? value.lastResult : null;

  return {
    status: value.status,
    winnings: value.winnings,
    finishReason: value.finishReason,
    position,
    amountAtStake,
    questionEndsAt,
    contestantId,
    lockedAnswer,
    correctIndex,
    lastResult,
    lifelines: readLifelines(value.lifelines, position, value.status),
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
