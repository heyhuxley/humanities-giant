export type CurrentQuestion = {
  id: string;
  text: string;
  options: [string, string, string, string];
};

type SessionStatus = 'waiting' | 'question_active' | 'locked' | 'revealed' | 'finished';

export function buildCurrentQuestion(
  status: SessionStatus,
  question: Record<string, unknown> | null,
): CurrentQuestion | null {
  if (status === 'waiting' || status === 'finished') return null;

  // Keep the question visible while locked and revealed so the reveal screen can show it.
  if (question === null || Array.isArray(question)) {
    throw new Error('A question is required for this session status.');
  }

  const { id, text, options } = question;
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof text !== 'string' ||
    text.length === 0 ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    typeof options[0] !== 'string' ||
    typeof options[1] !== 'string' ||
    typeof options[2] !== 'string' ||
    typeof options[3] !== 'string'
  ) {
    throw new Error('The question is malformed.');
  }

  return {
    id,
    text,
    options: [options[0], options[1], options[2], options[3]],
  };
}
