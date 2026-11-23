import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('host session query', () => {
  it('selects session questions through their direct foreign key', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'app', 'host', 'sessions', '[id]', 'page.tsx'),
      'utf8',
    );

    expect(source).toContain(
      'session_questions!session_questions_session_id_fkey(position, questions(text))',
    );
  });
});
