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

const HOST_PAGE = 'src/app/host/sessions/[id]/page.tsx';
const HOST_CONTROLS = 'src/app/host/sessions/[id]/session-controls.tsx';
const HOST_ACTIONS = 'src/app/host/sessions/[id]/actions.ts';
const COUNTDOWN_TIMER = 'src/components/countdown-timer';
const HOST_SENSITIVE_FIELDS = ['question_answers', 'correct_index', 'session_private'];

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

function importsClientCountdown(page: SourceFile, component: SourceFile): boolean {
  const countdownImports = extractImports(page.source).filter((specifier) =>
    resolveSpecifier(specifier, page.path) === COUNTDOWN_TIMER,
  );
  return countdownImports.length === 1 && isClientFile(component.source);
}

function containsHostSensitiveField(source: string): boolean {
  const normalizedSource = source.toLowerCase();
  return HOST_SENSITIVE_FIELDS.some((field) => normalizedSource.includes(field));
}

function actionDefinitionPaths(files: SourceFile[], actionName: string): string[] {
  const definition = new RegExp(`\\bexport\\s+async\\s+function\\s+${actionName}\\s*\\(`);
  return files
    .filter((file) => !file.path.endsWith('.test.ts') && definition.test(file.source))
    .map((file) => file.path)
    .sort();
}

describe('session import boundaries', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));
  const answerDataFiles = findAnswerDataFiles(files);
  const castVoteFile = files.find((file) => file.path === 'src/lib/sessions/cast-vote.ts');
  const playerPurePaths = [
    'src/lib/sessions/player-forms.ts',
    'src/lib/sessions/player-flows.ts',
    'src/lib/sessions/player-messages.ts',
  ];
  const playerFiles = files.filter((file) =>
    playerPurePaths.includes(file.path) ||
    file.path === 'src/lib/sessions/verified-user.ts',
  );

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
      expect(source, file.path).not.toContain('correct_index');
    }
  });

  it('detects sensitive fields in fake host page and control sources', () => {
    expect(containsHostSensitiveField("const field = 'question_answers';")).toBe(true);
    expect(containsHostSensitiveField("const field = 'correct_index';")).toBe(true);
    expect(containsHostSensitiveField("const field = 'session_private';")).toBe(true);
  });

  it('keeps the scanned host page and controls free of sensitive fields', () => {
    const hostFiles = files.filter((file) =>
      file.path === HOST_PAGE || file.path === HOST_CONTROLS,
    );
    expect(hostFiles.map((file) => file.path).sort()).toEqual([HOST_PAGE, HOST_CONTROLS]);

    for (const file of hostFiles) {
      expect(containsHostSensitiveField(file.source), file.path).toBe(false);
    }
  });

  it('requires the host page countdown import to resolve to a client component', () => {
    const page: SourceFile = {
      path: HOST_PAGE,
      source: "import { CountdownTimer } from '../../../../components/countdown-timer';",
    };
    const clientTimer: SourceFile = {
      path: 'src/components/countdown-timer.tsx',
      source: "'use client';\nexport function CountdownTimer() {}",
    };
    const serverTimer: SourceFile = {
      ...clientTimer,
      source: 'export function CountdownTimer() {}',
    };

    expect(importsClientCountdown(page, clientTimer)).toBe(true);
    expect(importsClientCountdown(page, serverTimer)).toBe(false);
    expect(importsClientCountdown({ ...page, source: 'export const page = true;' }, clientTimer)).toBe(false);
  });

  it('uses the scanned client countdown component from the host page', () => {
    const page = files.find((file) => file.path === HOST_PAGE);
    const timer = files.find((file) => file.path === `${COUNTDOWN_TIMER}.tsx`);
    expect(page).toBeDefined();
    expect(timer).toBeDefined();
    if (!page || !timer) throw new Error('Expected the host page and countdown component in the source scan.');

    expect(importsClientCountdown(page, timer)).toBe(true);
  });

  it('detects duplicate reveal and next actions in fake sources', () => {
    const fakeFiles: SourceFile[] = [
      { path: HOST_ACTIONS, source: 'export async function revealAction() {}' },
      { path: 'src/app/play/actions.ts', source: 'export async function revealAction() {}' },
      { path: HOST_ACTIONS, source: 'export async function nextAction() {}' },
      { path: 'src/app/play/actions.ts', source: 'export async function nextAction() {}' },
    ];

    expect(actionDefinitionPaths(fakeFiles, 'revealAction')).toEqual([
      HOST_ACTIONS,
      'src/app/play/actions.ts',
    ]);
    expect(actionDefinitionPaths(fakeFiles, 'nextAction')).toEqual([
      HOST_ACTIONS,
      'src/app/play/actions.ts',
    ]);
  });

  it('keeps reveal and next action definitions only in the scanned host actions file', () => {
    expect(actionDefinitionPaths(files, 'revealAction')).toEqual([HOST_ACTIONS]);
    expect(actionDefinitionPaths(files, 'nextAction')).toEqual([HOST_ACTIONS]);
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

  it('keeps player logic free of private fields and forbidden runtime dependencies', () => {
    expect(playerFiles.map((file) => file.path).sort()).toEqual([
      ...playerPurePaths,
      'src/lib/sessions/verified-user.ts',
    ].sort());
    expect(checkBoundaries(playerFiles)).toEqual([]);
  });

  it('allows client files to import player actions, but no other new player modules', () => {
    const playerModules = [
      ...playerPurePaths,
      'src/lib/sessions/verified-user',
    ];
    const clientFiles = files.filter((file) => isClientFile(file.source));
    for (const file of clientFiles) {
      const importedModules = extractImports(file.source)
        .map((specifier) => resolveSpecifier(specifier, file.path));
      for (const modulePath of playerModules) {
        expect(importedModules, file.path).not.toContain(modulePath);
      }
    }
  });

  it('keeps countdown and answering panels client safe and free of sensitive fields', () => {
    const paths = [
      'src/components/countdown-timer.tsx',
      'src/app/play/[sessionId]/contestant-panel.tsx',
      'src/app/play/[sessionId]/audience-panel.tsx',
    ];

    for (const path of paths) {
      const file = files.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      if (!file) continue;

      expect(isClientFile(file.source), path).toBe(true);
      const source = file.source.toLowerCase();
      expect(source, path).not.toContain('question_answers');
      expect(source, path).not.toContain('correct_index');
      expect(source, path).not.toContain('session_private');

      for (const specifier of extractImports(file.source)) {
        const importedPath = resolveSpecifier(specifier, file.path);
        expect(importedPath, path).not.toBe('src/lib/supabase/admin');
        expect(importedPath, path).not.toBe('src/lib/sessions/session-event-deps');
        expect(importedPath, path).not.toBe('src/lib/sessions/run-session-event');
        expect(importedPath, path).not.toBe('src/lib/sessions/answer-deps');
        expect(importedPath, path).not.toBe('src/lib/sessions/cast-vote');
        expect(importedPath, path).not.toMatch(/^src\/lib\/auth(?:\/|$)/);
      }
    }
  });

  it('keeps countdown helpers pure and outside React and Supabase', () => {
    for (const path of [
      'src/lib/sessions/countdown.ts',
      'src/lib/sessions/knock-loop.ts',
    ]) {
      const file = files.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      if (!file) continue;
      for (const specifier of extractImports(file.source)) {
        const importedPath = resolveSpecifier(specifier, file.path);
        expect(importedPath, path).not.toMatch(/^react(?:\/|$)/);
        expect(importedPath, path).not.toMatch(/^next(?:\/|$)/);
        expect(importedPath, path).not.toMatch(/^src\/lib\/supabase(?:\/|$)/);
      }
    }
  });
});
