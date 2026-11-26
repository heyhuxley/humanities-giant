import type { Option } from '../../game/types';

export type OptionState = {
  state: 'neutral' | 'locked' | 'correct' | 'wrong';
  icon: string;
  label: string;
};

export function optionStates(input: {
  lockedAnswer: Option | null;
  correctIndex: Option | null;
  revealed: boolean;
}): [OptionState, OptionState, OptionState, OptionState] {
  const stateFor = (index: Option): OptionState => {
    if (input.revealed && input.correctIndex === index) {
      return { state: 'correct', icon: '✓', label: 'Correct' };
    }
    if (
      input.revealed &&
      input.correctIndex !== null &&
      input.lockedAnswer === index &&
      input.lockedAnswer !== input.correctIndex
    ) {
      return { state: 'wrong', icon: '✗', label: 'Wrong' };
    }
    if (input.lockedAnswer === index) {
      return { state: 'locked', icon: '●', label: 'Locked in' };
    }
    return { state: 'neutral', icon: '', label: '' };
  };

  return [stateFor(0), stateFor(1), stateFor(2), stateFor(3)];
}

export function describeResult(input: {
  lastResult: 'correct' | 'wrong' | 'timeout' | null;
  role: 'contestant' | 'audience';
}): string | null {
  if (input.lastResult === null) return null;
  if (input.role === 'contestant') {
    if (input.lastResult === 'correct') return 'Correct!';
    if (input.lastResult === 'wrong') return 'Wrong answer.';
    return 'Time ran out.';
  }
  if (input.lastResult === 'correct') return 'The contestant got it right.';
  if (input.lastResult === 'wrong') return 'The contestant got it wrong.';
  return 'Time ran out.';
}

export function describeFinishReason(reason: string | null): string {
  if (reason === 'won') return 'Top prize won';
  if (reason === 'wrong') return 'Wrong answer';
  if (reason === 'timeout') return 'Time ran out';
  if (reason === 'walked_away') return 'Walked away';
  if (reason === 'ended_by_host') return 'Ended by the host';
  return 'Game finished';
}
