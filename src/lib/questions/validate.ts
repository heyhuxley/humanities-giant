export const QUESTION_SUBJECTS = ['english', 'economics', 'government', 'literature'] as const;
export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type QuestionInput = {
  subject: (typeof QUESTION_SUBJECTS)[number];
  difficulty: (typeof QUESTION_DIFFICULTIES)[number];
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

export type ValidationResult = { ok: true; value: QuestionInput } | { ok: false; errors: Record<string, string> };

export function validateQuestionInput(input: unknown): ValidationResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { subject: 'Enter a question object.' } };
  }

  const fields = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const subject = fields.subject;
  const difficulty = fields.difficulty;
  const rawText = fields.text;
  const rawOptions = fields.options;
  const correctIndex = fields.correctIndex;

  if (typeof subject !== 'string' || !QUESTION_SUBJECTS.includes(subject as QuestionInput['subject'])) errors.subject = 'Choose a valid subject.';
  if (typeof difficulty !== 'string' || !QUESTION_DIFFICULTIES.includes(difficulty as QuestionInput['difficulty'])) errors.difficulty = 'Choose a valid difficulty.';

  let text = '';
  if (typeof rawText !== 'string') errors.text = 'Enter question text.';
  else {
    text = rawText.trim();
    if (text.length < 1 || text.length > 200) errors.text = 'Question text must be 1 to 200 characters.';
  }

  let options: [string, string, string, string] = ['', '', '', ''];
  if (!Array.isArray(rawOptions) || rawOptions.length !== 4) errors.options = 'Enter exactly four options.';
  else {
    const trimmed: string[] = [];
    for (const option of rawOptions) {
      if (typeof option !== 'string') {
        errors.options = 'Each option must be text.';
        break;
      }
      const value = option.trim();
      if (value.length < 1 || value.length > 80) errors.options = 'Each option must be 1 to 80 characters.';
      trimmed.push(value);
    }
    if (trimmed.length === 4) {
      if (new Set(trimmed.map((option) => option.toLowerCase())).size !== 4) errors.options = 'Options must be distinct.';
      options = [trimmed[0], trimmed[1], trimmed[2], trimmed[3]];
    }
  }

  if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) errors.correctIndex = 'Choose an option from 0 to 3.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      subject: subject as QuestionInput['subject'],
      difficulty: difficulty as QuestionInput['difficulty'],
      text,
      options,
      correctIndex: correctIndex as QuestionInput['correctIndex'],
    },
  };
}
