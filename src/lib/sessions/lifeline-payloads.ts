import type { Option } from '../../game/types';

type RandomInt = (max: number) => number;

const INVALID_CORRECT_INDEX = 'Invalid correct index.';
const INVALID_RANDOM_INTEGER = 'Invalid random integer.';
const INVALID_REMOVED_OPTIONS = 'Invalid removed options.';
const INVALID_CORRECT_PERCENT = 'Invalid correct percent.';
const INVALID_VOTE_COUNTS = 'Invalid vote counts.';

function isOption(value: unknown): value is Option {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
}

function checkedOption(value: unknown): Option {
  if (!isOption(value)) throw new Error(INVALID_CORRECT_INDEX);
  return value;
}

function draw(randomInt: RandomInt, max: number): number {
  if (typeof randomInt !== 'function') throw new Error(INVALID_RANDOM_INTEGER);
  const value = randomInt(max);
  if (!Number.isInteger(value) || value < 0 || value >= max) {
    throw new Error(INVALID_RANDOM_INTEGER);
  }
  return value;
}

function checkedRemoved(
  removed: unknown,
  correctIndex?: Option,
): [Option, Option] | null {
  if (removed === null) return null;
  if (!Array.isArray(removed) || removed.length !== 2) {
    throw new Error(INVALID_REMOVED_OPTIONS);
  }
  const [first, second] = removed;
  if (
    !isOption(first) ||
    !isOption(second) ||
    first === second ||
    (correctIndex !== undefined && (first === correctIndex || second === correctIndex))
  ) {
    throw new Error(INVALID_REMOVED_OPTIONS);
  }
  return [first, second];
}

export function wrongOptions(correctIndex: Option): [Option, Option, Option] {
  const correct = checkedOption(correctIndex);
  return ([0, 1, 2, 3].filter((option) => option !== correct) as Option[])
    .sort((first, second) => first - second) as [Option, Option, Option];
}

export function buildFiftyFifty(
  correctIndex: Option,
  randomInt: RandomInt,
): [Option, Option] {
  const wrong = wrongOptions(correctIndex);
  const keptOption = wrong[draw(randomInt, 3)];
  return wrong.filter((option) => option !== keptOption) as [Option, Option];
}

export function buildPhoneHint(input: {
  correctIndex: Option;
  removed: [Option, Option] | null;
  randomInt: RandomInt;
  correctPercent?: number;
}): { hint: Option; hintIsCorrect: boolean } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Invalid phone hint input.');
  }
  const correct = checkedOption(input.correctIndex);
  const removed = checkedRemoved(input.removed, correct);
  const correctPercent = input.correctPercent === undefined ? 60 : input.correctPercent;
  if (
    typeof correctPercent !== 'number' ||
    !Number.isInteger(correctPercent) ||
    correctPercent < 0 ||
    correctPercent > 100
  ) {
    throw new Error(INVALID_CORRECT_PERCENT);
  }

  const roll = draw(input.randomInt, 100);
  if (roll < correctPercent) return { hint: correct, hintIsCorrect: true };

  const removedOptions: Option[] = removed ?? [];
  const candidates = wrongOptions(correct).filter(
    (option) => !removedOptions.includes(option),
  );
  if (candidates.length === 0) throw new Error(INVALID_REMOVED_OPTIONS);
  return {
    hint: candidates[draw(input.randomInt, candidates.length)],
    hintIsCorrect: false,
  };
}

export function maskRemovedVotes(
  counts: readonly [number, number, number, number],
  removed: [Option, Option] | null,
): [number, number, number, number] {
  if (
    !Array.isArray(counts) ||
    counts.length !== 4 ||
    counts.some((count) => typeof count !== 'number' || !Number.isInteger(count) || count < 0)
  ) {
    throw new Error(INVALID_VOTE_COUNTS);
  }
  const removedOptions = checkedRemoved(removed);
  const masked = [...counts] as [number, number, number, number];
  if (removedOptions !== null) {
    masked[removedOptions[0]] = 0;
    masked[removedOptions[1]] = 0;
  }
  return masked;
}

export function toVoteCounts(rows: unknown): [number, number, number, number] {
  try {
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    if (!Array.isArray(rows)) return counts;

    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) continue;
      let optionIndex: unknown;
      try {
        optionIndex = (row as { option_index?: unknown }).option_index;
      } catch {
        continue;
      }
      if (isOption(optionIndex)) counts[optionIndex] += 1;
    }
    return counts;
  } catch {
    return [0, 0, 0, 0];
  }
}
