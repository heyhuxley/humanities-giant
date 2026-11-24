import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkBoundaries,
  extractImports,
  findAnswerDataFiles,
  isActionFile,
  isClientFile,
  isTypeOnlyImport,
  resolveSpecifier,
} from '../../test-utils/import-boundaries';

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
  const answerDataFiles = findAnswerDataFiles(files);
  const castVoteFile = files.find((file) => file.path === 'src/lib/sessions/cast-vote.ts');

  it('scans all source files and rejects every forbidden import', () => {
    const paths = new Set(files.map((file) => file.path));
    expect(files.length).toBeGreaterThanOrEqual(50);
    expect(paths.has('src/app/host/sessions/[id]/page.tsx')).toBe(true);
    expect(paths.has('src/app/host/sessions/[id]/actions.ts')).toBe(true);
    expect(checkBoundaries(files)).toEqual([]);
  });

  it('keeps the live refresh component client safe', () => {
    const component = files.find((file) =>
      file.path === 'src/components/live-session-refresh.tsx',
    );
    expect(component).toBeDefined();
    if (!component) throw new Error('Expected the live refresh component in the source scan.');

    expect(isClientFile(component.source)).toBe(true);
    const imports = extractImports(component.source).map((specifier) =>
      resolveSpecifier(specifier, component.path),
    );
    for (const importedPath of imports) {
      expect(importedPath).not.toBe('src/lib/supabase/admin');
      expect(importedPath).not.toBe('src/lib/sessions/session-event-deps');
      expect(importedPath).not.toBe('src/lib/sessions/run-session-event');
      expect(importedPath).not.toBe('src/lib/sessions/create-session');
      expect(importedPath).not.toBe('src/lib/sessions/join-session');
      expect(importedPath).not.toMatch(/^src\/lib\/auth(?:\/|$)/);
    }

    const source = component.source.toLowerCase();
    expect(source).not.toContain('session_private');
    expect(source).not.toContain('question_answers');
    expect(source).not.toContain('correct_index');
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

  it('allows answer fields in exactly the current host bank files and answer loader', () => {
    expect(answerDataFiles).toEqual([
      'src/app/host/questions/[id]/edit/page.tsx',
      'src/app/host/questions/actions.ts',
      'src/app/host/questions/page.tsx',
      'src/lib/sessions/answer-deps.ts',
    ]);

    expect(answerDataFiles).not.toContain('src/lib/sessions/run-session-event.ts');
    expect(answerDataFiles).not.toContain('src/lib/sessions/session-event-deps.ts');
    for (const file of files) {
      if (file.path.startsWith('src/app/play/') || file.path.startsWith('src/app/join/')) {
        expect(answerDataFiles, file.path).not.toContain(file.path);
      }
    }
  });

  it('keeps answer dependencies out of player routes and client files', () => {
    for (const file of files) {
      const importsAnswerDeps = extractImports(file.source).some((specifier) =>
        resolveSpecifier(specifier, file.path) === 'src/lib/sessions/answer-deps',
      );
      if (file.path.startsWith('src/app/play/') || file.path.startsWith('src/app/join/')) {
        expect(importsAnswerDeps, file.path).toBe(false);
      }
      if (isClientFile(file.source)) expect(importsAnswerDeps, file.path).toBe(false);
    }
  });

  it('keeps answer field names out of the cast vote module', () => {
    expect(castVoteFile).toBeDefined();
    expect(answerDataFiles).not.toContain('src/lib/sessions/cast-vote.ts');
  });

  it('limits cast vote runtime imports to app actions and excludes client files', () => {
    const castVoteImports = files.filter((file) =>
      extractImports(file.source).some((specifier) =>
        resolveSpecifier(specifier, file.path) === 'src/lib/sessions/cast-vote',
      ),
    );

    for (const file of castVoteImports) {
      const importedSpecifiers = extractImports(file.source).filter((specifier) =>
        resolveSpecifier(specifier, file.path) === 'src/lib/sessions/cast-vote',
      );
      if (isClientFile(file.source)) expect(importedSpecifiers).toEqual([]);
      for (const specifier of importedSpecifiers) {
        if (
          !file.path.endsWith('.test.ts')
          && !isTypeOnlyImport(file.source, specifier)
        ) {
          expect(isActionFile(file.path), file.path).toBe(true);
        }
      }
    }
  });
});
