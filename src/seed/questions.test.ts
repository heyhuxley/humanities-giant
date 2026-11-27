import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface SeedQuestion {
  subject: string;
  difficulty: string;
  text: string;
  options: string[];
  correctIndex: number;
}

const questions = JSON.parse(readFileSync(join(process.cwd(), 'seed', 'questions.json'), 'utf8')) as SeedQuestion[];
const subjects = ['english', 'economics', 'government', 'literature'];
const difficulties = ['easy', 'medium', 'hard'];

describe('question seed data', () => {
  it('contains 40 questions, ten per subject, with difficulty counts 4, 3, 3', () => {
    expect(questions).toHaveLength(40);
    for (const subject of subjects) {
      const group = questions.filter((question) => question.subject === subject);
      expect(group).toHaveLength(10);
      expect(Object.fromEntries(difficulties.map((difficulty) => [difficulty, group.filter((question) => question.difficulty === difficulty).length])))
        .toEqual({ easy: 4, medium: 3, hard: 3 });
    }
  });
  it('uses allowed subjects and difficulties', () => {
    for (const question of questions) {
      expect(subjects).toContain(question.subject);
      expect(difficulties).toContain(question.difficulty);
    }
  });
  it('has four distinct nonempty options and a valid answer index', () => {
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      expect(question.options.every((option) => typeof option === 'string' && option.trim().length > 0)).toBe(true);
      expect(new Set(question.options.map((option) => option.trim().toLowerCase())).size).toBe(4);
      expect(Number.isInteger(question.correctIndex)).toBe(true);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThanOrEqual(3);
    }
  });
  it('has unique question text and respects length limits', () => {
    const normalized = questions.map((question) => question.text.trim().toLowerCase());
    expect(new Set(normalized).size).toBe(questions.length);
    for (const question of questions) {
      expect(question.text.length).toBeLessThan(200);
      for (const option of question.options) expect(option.length).toBeLessThan(80);
    }
  });
  it('spreads answer indexes and avoids runs longer than three', () => {
    const counts = [0, 1, 2, 3].map((index) => questions.filter((question) => question.correctIndex === index).length);
    expect(counts.every((count) => count >= 8 && count <= 12)).toBe(true);
    let run = 1;
    for (let index = 1; index < questions.length; index += 1) {
      run = questions[index].correctIndex === questions[index - 1].correctIndex ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(3);
    }
  });
});
