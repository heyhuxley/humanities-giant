export function mapQuestionDbError(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'code' in error && error.code === '23503') {
    return "This question is used in a session and can't be deleted.";
  }
  return 'Something went wrong. Try again.';
}
