import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('session creation import boundaries', () => {
  it('keeps session creation and the admin client out of app files except the authorized action import', () => {
    const files = sourceFiles(join(process.cwd(), 'src', 'app'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const normalizedPath = file.replaceAll('\\', '/');
      const clientFile = /^\s*(['"])use client\1/m.test(source);
      const createSessionImport = /from\s+['"][^'"]*sessions\/create-session['"]/m.test(source);
      const joinSessionImport = /from\s+['"][^'"]*sessions\/join-session['"]/m.test(source);
      const adminImport = /from\s+['"][^'"]*supabase\/admin['"]/m.test(source);

      if (createSessionImport) {
        expect(normalizedPath).toMatch(/\/src\/app\/host\/sessions\/actions\.ts$/);
        expect(source).toMatch(/import\s+\{\s*createSession\s*\}\s+from\s+['"][^'"]*sessions\/create-session['"]/m);
      }
      if (joinSessionImport) expect(normalizedPath).toMatch(/\/actions\.ts$/);
      expect(adminImport, file).toBe(false);
      if (clientFile) {
        expect(createSessionImport, file).toBe(false);
        expect(joinSessionImport, file).toBe(false);
        expect(adminImport, file).toBe(false);
      }
    }
  });

  it('keeps player routes away from private session and answer tables', () => {
    const appRoot = join(process.cwd(), 'src', 'app');
    const playerFiles = [
      ...sourceFiles(join(appRoot, 'play')),
      ...sourceFiles(join(appRoot, 'join')),
    ];

    for (const file of playerFiles) {
      const source = readFileSync(file, 'utf8').toLowerCase();
      expect(source, file).not.toContain('session_private');
      expect(source, file).not.toContain('question_answers');
    }
  });
});
