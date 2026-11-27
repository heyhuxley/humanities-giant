export function formDataToQuestionInput(formData: FormData): unknown {
  const rawIndex = formData.get('correctIndex');
  let correctIndex: unknown = rawIndex;
  if (typeof rawIndex === 'string' && rawIndex.trim() !== '') {
    const parsed = Number(rawIndex);
    if (Number.isFinite(parsed)) correctIndex = parsed;
  }
  return {
    subject: formData.get('subject'),
    difficulty: formData.get('difficulty'),
    text: formData.get('text'),
    options: [formData.get('option0'), formData.get('option1'), formData.get('option2'), formData.get('option3')],
    correctIndex,
  };
}
