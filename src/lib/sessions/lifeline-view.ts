import type { Option } from '../../game/types';

export type OptionAvailability = [boolean, boolean, boolean, boolean];

export type AudienceBarRow = {
  label: 'A' | 'B' | 'C' | 'D';
  percent: number;
  text: string;
};

export type AudienceBarResult =
  | { kind: 'bars'; rows: [AudienceBarRow, AudienceBarRow, AudienceBarRow, AudienceBarRow] }
  | { kind: 'not_enough'; text: 'Not enough audience votes' };

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export function letterFor(option: Option): 'A' | 'B' | 'C' | 'D' {
  return OPTION_LABELS[option];
}

export function optionAvailability(
  removed: [Option, Option] | null,
): OptionAvailability {
  return [
    removed?.includes(0) !== true,
    removed?.includes(1) !== true,
    removed?.includes(2) !== true,
    removed?.includes(3) !== true,
  ];
}

export function phoneHintMessage(hint: Option | null): string | null {
  return hint === null ? null : `Your friend thinks the answer is ${letterFor(hint)}`;
}

export function audienceBarRows(
  percentages: [number, number, number, number] | null,
  notEnoughVotes: boolean,
): AudienceBarResult | null {
  if (notEnoughVotes) {
    return { kind: 'not_enough', text: 'Not enough audience votes' };
  }
  if (percentages === null) return null;

  return {
    kind: 'bars',
    rows: [
      { label: 'A', percent: percentages[0], text: `A: ${percentages[0]}%` },
      { label: 'B', percent: percentages[1], text: `B: ${percentages[1]}%` },
      { label: 'C', percent: percentages[2], text: `C: ${percentages[2]}%` },
      { label: 'D', percent: percentages[3], text: `D: ${percentages[3]}%` },
    ],
  };
}
