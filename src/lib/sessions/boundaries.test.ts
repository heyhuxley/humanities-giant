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
  it('limits admin client imports to server data modules', () => {
    const files = sourceFiles(join(process.cwd(), 'src'));
    const allowed = new Set([
      join(process.cwd(), 'src', 'lib', 'sessions', 'create-session.ts').replaceAll('\\', '/'),
      join(process.cwd(), 'src', 'lib', 'sessions', 'join-session.ts').replaceAll('\\', '/'),
      join(process.cwd(), 'src', 'lib', 'sessions', 'session-event-deps.ts').replaceAll('\\', '/'),
    ]);

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const importsAdmin = /from\s+['"][^'"]*supabase\/admin['"]/m.test(source);
      if (importsAdmin) expect(allowed.has(file.replaceAll('\\', '/')), file).toBe(true);
    }
  });

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

  it('keeps the session event runner in server session and action files', () => {
    const files = sourceFiles(join(process.cwd(), 'src'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const normalizedPath = file.replaceAll('\\', '/');
      const clientFile = /^\s*(['"])use client\1/m.test(source);
      const runSessionEventImport =
        /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*run-session-event['"]/m.test(source);
      const sessionEventDepsImport =
        /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*session-event-deps['"]/m.test(source);
      const adminImport = /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*supabase\/admin['"]/m.test(source);

      if (runSessionEventImport) {
        expect(normalizedPath).toMatch(
          /\/src\/(?:lib\/sessions\/[^/]+|app\/(?:.*\/)?actions\.ts)$/,
        );
      }
      if (sessionEventDepsImport && !normalizedPath.endsWith('.test.ts')) {
        expect(normalizedPath).toMatch(/\/src\/app\/(?:.*\/)?actions\.ts$/);
      }
      if (clientFile) {
        expect(runSessionEventImport, file).toBe(false);
        expect(sessionEventDepsImport, file).toBe(false);
        expect(adminImport, file).toBe(false);
      }
    }
  });

  it('keeps private tables and answer fields out of host session pages', () => {
    const files = sourceFiles(join(process.cwd(), 'src', 'app', 'host', 'sessions'));
    for (const file of files) {
      const source = readFileSync(file, 'utf8').toLowerCase();
      expect(source, file).not.toContain('session_private');
      expect(source, file).not.toContain('question_answers');
    }
  });

  it('keeps the session event dependency query away from answer data', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'lib', 'sessions', 'session-event-deps.ts'),
      'utf8',
    ).toLowerCase();
    expect(source).not.toContain('question_answers');
    expect(source).not.toContain('correct_index');
    expect(source).not.toContain("select('*')");
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
