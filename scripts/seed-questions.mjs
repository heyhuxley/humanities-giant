import { readFile } from 'node:fs/promises';

// Plain .mjs is intentional because this script runs outside the Next.js build.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const subjects = ['english', 'economics', 'government', 'literature'];
const difficulties = ['easy', 'medium', 'hard'];
const counts = (items, key, values) => Object.fromEntries(values.map((value) => [value, items.filter((item) => item[key] === value).length]));

function validate(questions) {
  if (!Array.isArray(questions) || questions.length !== 40) throw new Error('Seed data must be an array of exactly 40 questions.');
  for (const subject of subjects) {
    const group = questions.filter((question) => question.subject === subject);
    if (group.length !== 10 || counts(group, 'difficulty', difficulties).easy !== 4 || counts(group, 'difficulty', difficulties).medium !== 3 || counts(group, 'difficulty', difficulties).hard !== 3) {
      throw new Error(`Seed data for ${subject} must contain 4 easy, 3 medium, and 3 hard questions.`);
    }
  }
  const texts = new Set();
  for (const [index, question] of questions.entries()) {
    if (!subjects.includes(question.subject) || !difficulties.includes(question.difficulty)) throw new Error(`Question ${index + 1} has an invalid subject or difficulty.`);
    if (typeof question.text !== 'string' || question.text.trim().length === 0 || question.text.length >= 200) throw new Error(`Question ${index + 1} has invalid text.`);
    const normalized = question.text.trim().toLowerCase();
    if (texts.has(normalized)) throw new Error(`Question ${index + 1} duplicates question text.`);
    texts.add(normalized);
    if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some((option) => typeof option !== 'string' || option.trim().length === 0 || option.length >= 80) || new Set(question.options.map((option) => option.trim().toLowerCase())).size !== 4) throw new Error(`Question ${index + 1} must have four distinct nonempty options under 80 characters.`);
    if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) throw new Error(`Question ${index + 1} has an invalid correctIndex.`);
  }
  for (let index = 3; index < questions.length; index += 1) {
    if (questions[index].correctIndex === questions[index - 1].correctIndex && questions[index].correctIndex === questions[index - 2].correctIndex && questions[index].correctIndex === questions[index - 3].correctIndex) throw new Error('Seed data has more than three consecutive identical correctIndex values.');
  }
  const answerCounts = [0, 1, 2, 3].map((answer) => questions.filter((question) => question.correctIndex === answer).length);
  if (answerCounts.some((count) => count < 8 || count > 12)) throw new Error('Each correctIndex value must appear between 8 and 12 times.');
}

const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const hostId = env.SEED_HOST_ID;
for (const [name, value] of [['NEXT_PUBLIC_SUPABASE_URL', url], ['SUPABASE_SERVICE_ROLE_KEY', serviceKey], ['SEED_HOST_ID', hostId]]) {
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
}
if (!uuidPattern.test(hostId)) throw new Error('SEED_HOST_ID must be a valid UUID.');

const questions = JSON.parse(await readFile(new URL('../seed/questions.json', import.meta.url), 'utf8'));
validate(questions);
if (process.argv.includes('--dry-run')) {
  console.log('Seed data validated.');
  console.log('By subject:', counts(questions, 'subject', subjects));
  console.log('By difficulty:', counts(questions, 'difficulty', difficulties));
  console.log('Inserted: 0, skipped: 0, failed: 0 (dry run).');
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let inserted = 0;
let skipped = 0;
let failed = 0;
const existingTexts = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await client.from('questions').select('text').eq('created_by', hostId).range(from, from + 999);
  if (error) {
    failed = questions.length;
    console.error(`Failed to read existing questions: ${error.message}`);
    console.log(`Inserted: ${inserted}, skipped: ${skipped}, failed: ${failed}.`);
    process.exitCode = 1;
    break;
  }
  for (const row of data) existingTexts.add(row.text);
  if (data.length < 1000) break;
}

if (failed === 0) {
  const pending = questions.filter((question) => {
    if (existingTexts.has(question.text)) { skipped += 1; return false; }
    return true;
  });
  if (pending.length > 0) {
    const questionRows = pending.map(({ subject, difficulty, text, options }) => ({ subject, difficulty, text, options, created_by: hostId }));
    const { data: insertedQuestions, error: questionError } = await client.from('questions').insert(questionRows).select('id, text');
    if (questionError || !insertedQuestions) {
      failed = pending.length;
      console.error(`Failed to insert questions: ${questionError?.message ?? 'No inserted rows returned.'}`);
    } else {
      const answers = insertedQuestions.map(({ id, text }) => ({ question_id: id, correct_index: pending.find((question) => question.text === text).correctIndex }));
      const { error: answerError } = await client.from('question_answers').insert(answers);
      if (answerError) {
        const { error: rollbackError } = await client.from('questions').delete().in('id', insertedQuestions.map(({ id }) => id));
        failed = pending.length;
        console.error(`Failed to insert answers: ${answerError.message}`);
        if (rollbackError) console.error(`Rollback failed: ${rollbackError.message}`);
      } else inserted = insertedQuestions.length;
    }
  }
  console.log(`Inserted: ${inserted}, skipped: ${skipped}, failed: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}
