import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBoundaries } from '@/test-utils/import-boundaries';

type SourceFile = { path: string; source: string };

function sourceFiles(directory: string): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [{
      path: relative(process.cwd(), absolutePath).replaceAll('\\', '/'),
      source: readFileSync(absolutePath, 'utf8'),
    }];
  });
}

describe('session import boundaries', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));

  it('scans all source files and rejects every forbidden import', () => {
    const paths = new Set(files.map((file) => file.path));
    expect(files.length).toBeGreaterThanOrEqual(50);
    expect(paths.has('src/app/host/sessions/[id]/page.tsx')).toBe(true);
    expect(paths.has('src/app/host/sessions/[id]/actions.ts')).toBe(true);
    expect(checkBoundaries(files)).toEqual([]);
  });

  it('keeps private tables and answer fields out of host session pages', () => {
    const hostSessionFiles = files.filter((file) =>
      file.path.startsWith('src/app/host/sessions/'),
    );
    expect(hostSessionFiles.length).toBeGreaterThan(0);
    for (const file of hostSessionFiles) {
      const source = file.source.toLowerCase();
      expect(source, file.path).not.toContain('session_private');
      expect(source, file.path).not.toContain('question_answers');
    }
  });

  it('keeps the session event dependency query away from answer data and select all', () => {
    const depsFile = files.find((file) =>
      file.path === 'src/lib/sessions/session-event-deps.ts',
    );
    expect(depsFile).toBeDefined();
    const source = depsFile?.source.toLowerCase() ?? '';
    expect(source).not.toContain('question_answers');
    expect(source).not.toContain('correct_index');
    expect(source).not.toMatch(/\.select\s*\(\s*(?:['"]\*['"]|`\*`)?\s*\)/);
  });

  it('keeps player routes away from private session and answer tables', () => {
    const playerFiles = files.filter((file) =>
      file.path.startsWith('src/app/play/') || file.path.startsWith('src/app/join/'),
    );

    for (const file of playerFiles) {
      const source = file.source.toLowerCase();
      expect(source, file.path).not.toContain('session_private');
      expect(source, file.path).not.toContain('question_answers');
    }
  });
});
